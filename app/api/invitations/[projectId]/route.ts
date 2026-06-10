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

// PATCH — accept or decline a project invitation
// body: { action: "accept" | "decline" }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await authenticate(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;

  let body: { action?: "accept" | "decline" };
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: "Invalid body" }, { status: 400 });
  }

  if (body.action !== "accept" && body.action !== "decline") {
    return NextResponse.json({ success: false, error: "action must be 'accept' or 'decline'" }, { status: 400 });
  }

  // Verify there is a pending invitation for this user
  const { data: invite } = await supabaseAdmin
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .single();

  if (!invite) {
    return NextResponse.json({ success: false, error: "No pending invitation found" }, { status: 404 });
  }

  if (body.action === "accept") {
    const { error } = await supabaseAdmin
      .from("project_members")
      .update({ status: "active" } as never)
      .eq("project_id", projectId)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    await supabaseAdmin.from("activity_log").insert({
      project_id: projectId,
      user_id: user.id,
      action: "joined_project",
      target_type: null,
      target_name: null,
      target_id: null,
    } as never);

    return NextResponse.json({ success: true, action: "accepted" });
  } else {
    const { error } = await supabaseAdmin
      .from("project_members")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, action: "declined" });
  }
}
