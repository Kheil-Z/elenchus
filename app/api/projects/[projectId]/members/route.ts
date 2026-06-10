import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function authenticate(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await authenticate(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;

  let body: { email?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: "Invalid body" }, { status: 400 });
  }

  const { email } = body;
  if (!email?.trim()) return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });

  // Caller must be an active can_edit member
  const { data: callerData } = await supabaseAdmin
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  const caller = callerData as unknown as { role: string } | null;
  if (!caller || caller.role !== "can_edit") {
    return NextResponse.json({ success: false, error: "Only editors can invite members" }, { status: 403 });
  }

  // Look up the invitee by email
  const { data: inviteeData } = await supabaseAdmin
    .from("users")
    .select("id, display_name, color")
    .eq("email", email.trim().toLowerCase())
    .single();

  const invitee = inviteeData as unknown as { id: string; display_name: string; color: string } | null;
  if (!invitee) {
    return NextResponse.json(
      { success: false, error: "No Elenchus account found for that email address." },
      { status: 404 }
    );
  }

  // Check not already a member or already invited
  const { data: existing } = await supabaseAdmin
    .from("project_members")
    .select("id, status")
    .eq("project_id", projectId)
    .eq("user_id", invitee.id)
    .single();

  if (existing) {
    const row = existing as unknown as { status: string };
    const msg = row.status === "pending" ? "This person has already been invited." : "This person is already a member.";
    return NextResponse.json({ success: false, error: msg }, { status: 409 });
  }

  const inviterProfile = await supabaseAdmin.from("users").select("display_name").eq("id", user.id).single();
  const inviterName = (inviterProfile.data as unknown as { display_name: string } | null)?.display_name ?? "Someone";

  // Create pending invitation
  const { error: insertError } = await supabaseAdmin
    .from("project_members")
    .insert({ project_id: projectId, user_id: invitee.id, role: "can_use", status: "pending", invited_by_name: inviterName } as never);

  if (insertError) {
    return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
  }

  // Log activity
  await supabaseAdmin.from("activity_log").insert({
    project_id: projectId,
    user_id: user.id,
    action: "invited_member",
    target_type: "member",
    target_name: invitee.display_name,
    target_id: invitee.id,
  } as never);

  return NextResponse.json({ success: true, member: invitee });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await authenticate(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get("userId");
  if (!targetUserId) return NextResponse.json({ success: false, error: "userId required" }, { status: 400 });

  // Only can_edit members can remove others; anyone can remove themselves
  if (targetUserId !== user.id) {
    const { data: callerData } = await supabaseAdmin
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    const caller = callerData as unknown as { role: string } | null;
    if (!caller || caller.role !== "can_edit") {
      return NextResponse.json({ success: false, error: "Only editors can remove members" }, { status: 403 });
    }
  }

  // Get the target user's name for the activity log
  const { data: targetData } = await supabaseAdmin
    .from("users")
    .select("display_name")
    .eq("id", targetUserId)
    .single();
  const targetName = (targetData as unknown as { display_name: string } | null)?.display_name ?? null;

  const { error } = await supabaseAdmin
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", targetUserId);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const isSelf = targetUserId === user.id;
  await supabaseAdmin.from("activity_log").insert({
    project_id: projectId,
    user_id: user.id,
    action: isSelf ? "left_project" : "removed_member",
    target_type: "member",
    target_name: isSelf ? null : targetName,
    target_id: isSelf ? null : targetUserId,
  } as never);

  return NextResponse.json({ success: true });
}
