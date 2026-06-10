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

// DELETE — remove a document from storage and DB
// Allowed if: uploader OR can_edit project member
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const user = await authenticate(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { documentId } = await params;

  const { data: doc } = await supabaseAdmin
    .from("documents")
    .select("project_id, name, storage_path, uploaded_by, conversation_id")
    .eq("id", documentId)
    .single();

  if (!doc) return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });

  const d = doc as unknown as {
    project_id: string; name: string; storage_path: string;
    uploaded_by: string; conversation_id: string | null;
  };

  // Check permission: uploader always can delete; otherwise must be can_edit
  if (d.uploaded_by !== user.id) {
    const { data: member } = await supabaseAdmin
      .from("project_members")
      .select("role")
      .eq("project_id", d.project_id)
      .eq("user_id", user.id)
      .single();

    const role = (member as unknown as { role: string } | null)?.role;
    if (role !== "can_edit") {
      return NextResponse.json({ success: false, error: "Only the uploader or editors can delete documents" }, { status: 403 });
    }
  }

  // Delete from storage first (non-fatal if missing — file may have been removed manually)
  await supabaseAdmin.storage.from("documents").remove([d.storage_path]);

  const { error: dbError } = await supabaseAdmin
    .from("documents")
    .delete()
    .eq("id", documentId);

  if (dbError) return NextResponse.json({ success: false, error: dbError.message }, { status: 500 });

  // Cascade-delete messages whose content is solely a sentinel for this document.
  // e.g. "[doc:uuid:filename]" — sidebar upload notifications with no other text.
  // Messages that also have real text are left alone; the chip degrades gracefully.
  const exactSentinelRe = new RegExp(`^\\[doc:${documentId}:[^\\]]+\\]$`);
  const { data: candidateMsgs } = await supabaseAdmin
    .from("messages")
    .select("id, content")
    .like("content" as never, `%${documentId}%`);

  const docOnlyMsgIds = ((candidateMsgs ?? []) as unknown as Array<{ id: string; content: string }>)
    .filter((m) => exactSentinelRe.test(m.content.trim()))
    .map((m) => m.id);

  if (docOnlyMsgIds.length > 0) {
    await supabaseAdmin.from("messages").delete().in("id" as never, docOnlyMsgIds);
  }

  // Fetch conversation name if scoped (for activity log)
  let convName: string | null = null;
  if (d.conversation_id) {
    const { data: conv } = await supabaseAdmin
      .from("conversations").select("name").eq("id", d.conversation_id).single();
    convName = (conv as unknown as { name: string } | null)?.name ?? null;
  }

  await supabaseAdmin.from("activity_log").insert({
    project_id: d.project_id,
    user_id: user.id,
    action: "deleted_document",
    target_type: "document",
    target_name: d.name,
    target_id: documentId,
    metadata: d.conversation_id
      ? { scope: "chat", conversation_id: d.conversation_id, conversation_name: convName }
      : { scope: "project" },
  } as never);

  return NextResponse.json({ success: true });
}
