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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const user = await authenticate(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { conversationId } = await params;

  let body: { name?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: "Invalid body" }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
  }

  // Verify user is a member of the conversation's project
  const { data: convData } = await supabaseAdmin
    .from("conversations")
    .select("project_id")
    .eq("id", conversationId)
    .single();

  const conv = convData as unknown as { project_id: string } | null;
  if (!conv) return NextResponse.json({ success: false, error: "Conversation not found" }, { status: 404 });

  const { data: memberCheck } = await supabaseAdmin
    .from("project_members")
    .select("user_id")
    .eq("project_id", conv.project_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!memberCheck) return NextResponse.json({ success: false, error: "Not a project member" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("conversations")
    .update({ name: body.name.trim() } as never)
    .eq("id", conversationId)
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await supabaseAdmin.from("activity_log").insert({
    project_id: conv.project_id,
    user_id: user.id,
    action: "renamed_conversation",
    target_type: "conversation",
    target_name: body.name!.trim(),
    target_id: conversationId,
  } as never);

  return NextResponse.json({ success: true, conversation: data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const user = await authenticate(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { conversationId } = await params;

  const { data: convData } = await supabaseAdmin
    .from("conversations")
    .select("project_id, name")
    .eq("id", conversationId)
    .single();

  const conv = convData as unknown as { project_id: string; name: string } | null;
  if (!conv) return NextResponse.json({ success: false, error: "Conversation not found" }, { status: 404 });

  const { data: memberCheck } = await supabaseAdmin
    .from("project_members")
    .select("role")
    .eq("project_id", conv.project_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  const member = memberCheck as unknown as { role: string } | null;
  if (!member) return NextResponse.json({ success: false, error: "Not a project member" }, { status: 403 });
  if (member.role !== "can_edit") return NextResponse.json({ success: false, error: "Only editors can delete conversations" }, { status: 403 });

  const { error } = await supabaseAdmin
    .from("conversations")
    .delete()
    .eq("id", conversationId);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await supabaseAdmin.from("activity_log").insert({
    project_id: conv.project_id,
    user_id: user.id,
    action: "deleted_conversation",
    target_type: "conversation",
    target_name: conv.name,
    target_id: conversationId,
  } as never);

  return NextResponse.json({ success: true });
}
