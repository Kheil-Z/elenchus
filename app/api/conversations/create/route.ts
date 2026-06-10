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

async function logActivity(projectId: string, userId: string, action: string, targetType: string, targetName: string, targetId: string) {
  await supabaseAdmin.from("activity_log").insert({
    project_id: projectId,
    user_id: userId,
    action,
    target_type: targetType,
    target_name: targetName,
    target_id: targetId,
  } as never);
}

export async function POST(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  let body: { projectId?: string; name?: string; memberIds?: string[] };
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: "Invalid body" }, { status: 400 });
  }

  const { projectId, name, memberIds = [] } = body;
  if (!projectId || !name?.trim()) {
    return NextResponse.json({ success: false, error: "projectId and name are required" }, { status: 400 });
  }

  // Verify caller is a project member
  const { data: memberCheck } = await supabaseAdmin
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!memberCheck) return NextResponse.json({ success: false, error: "Not a project member" }, { status: 403 });

  // Create conversation
  const { data: convData, error: convError } = await supabaseAdmin
    .from("conversations")
    .insert({
      project_id: projectId,
      name: name.trim(),
      creator_user_id: user.id,
      claude_mode: "manual",
      payer_mode: "last_speaker",
      designated_payer_id: null,
      token_budget: null,
      hard_stop: false,
    } as never)
    .select()
    .single();

  if (convError || !convData) {
    return NextResponse.json({ success: false, error: convError?.message ?? "Failed to create conversation" }, { status: 500 });
  }

  const conv = convData as unknown as { id: string; name: string; project_id: string; created_at: string };

  // Add creator + all invited members to conversation_members
  const allMemberIds = Array.from(new Set([user.id, ...memberIds]));
  await supabaseAdmin.from("conversation_members").insert(
    allMemberIds.map((uid) => ({ conversation_id: conv.id, user_id: uid } as never))
  );

  // Log activity
  await logActivity(projectId, user.id, "created_conversation", "conversation", conv.name, conv.id);

  return NextResponse.json({ success: true, conversation: conv });
}
