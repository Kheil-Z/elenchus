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

// PATCH — change document scope (conversationId: string = chat-only, null = project-wide)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const user = await authenticate(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { documentId } = await params;
  const body = await req.json().catch(() => ({}));
  if (body.conversationId !== undefined && body.conversationId !== null && typeof body.conversationId !== "string") {
    return NextResponse.json({ success: false, error: "conversationId must be a string or null" }, { status: 400 });
  }
  const conversationId: string | null = body.conversationId ? String(body.conversationId) : null;

  // Get the document to verify ownership / project
  const { data: doc } = await supabaseAdmin
    .from("documents")
    .select("project_id, name")
    .eq("id", documentId)
    .single();

  if (!doc) return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });

  const { project_id: projectId, name: docName } = doc as unknown as { project_id: string; name: string };

  // Must be a project member
  const { data: member } = await supabaseAdmin
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!member) return NextResponse.json({ success: false, error: "Not a project member" }, { status: 403 });

  // If scoping to a conversation, verify it belongs to the same project
  let conversationName: string | null = null;
  if (conversationId) {
    const { data: conv } = await supabaseAdmin
      .from("conversations")
      .select("project_id, name")
      .eq("id", conversationId)
      .single();
    const convRow = conv as unknown as { project_id: string; name: string } | null;
    if (!convRow || convRow.project_id !== projectId) {
      return NextResponse.json({ success: false, error: "Conversation not in this project" }, { status: 400 });
    }
    conversationName = convRow.name;
  }

  const { error } = await supabaseAdmin
    .from("documents")
    .update({ conversation_id: conversationId } as never)
    .eq("id", documentId);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await supabaseAdmin.from("activity_log").insert({
    project_id: projectId,
    user_id: user.id,
    action: "moved_document_scope",
    target_type: "document",
    target_name: docName,
    target_id: documentId,
    metadata: conversationId
      ? { scope: "chat", conversation_id: conversationId, conversation_name: conversationName }
      : { scope: "project" },
  } as never);

  return NextResponse.json({ success: true });
}
