import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateFileMime } from "@/lib/validate";
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

// GET — list documents for a project (all scopes)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await authenticate(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;

  const { data: memberCheck } = await supabaseAdmin
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!memberCheck) return NextResponse.json({ success: false, error: "Not a project member" }, { status: 403 });

  const { data: docsData, error: docsError } = await supabaseAdmin
    .from("documents")
    .select("id, name, storage_path, size_bytes, mime_type, uploaded_by, created_at, conversation_id, content_length")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (docsError) return NextResponse.json({ success: false, error: docsError.message }, { status: 500 });

  const docs = (docsData ?? []) as unknown as Array<{
    id: string; name: string; storage_path: string; size_bytes: number;
    mime_type: string | null; uploaded_by: string; created_at: string;
    conversation_id: string | null; content_length: number | null;
  }>;

  // Enrich with uploader names
  const uploaderIds = Array.from(new Set(docs.map((d) => d.uploaded_by)));
  let uploaderMap: Record<string, string> = {};
  if (uploaderIds.length > 0) {
    const { data: usersData } = await supabaseAdmin
      .from("users")
      .select("id, display_name")
      .in("id", uploaderIds);
    (usersData ?? []).forEach((u) => {
      const row = u as unknown as { id: string; display_name: string };
      uploaderMap[row.id] = row.display_name;
    });
  }

  // Enrich with conversation names for scoped docs
  const convIds = Array.from(new Set(docs.map((d) => d.conversation_id).filter(Boolean))) as string[];
  let convNameMap: Record<string, string> = {};
  if (convIds.length > 0) {
    const { data: convData } = await supabaseAdmin
      .from("conversations")
      .select("id, name")
      .in("id", convIds);
    (convData ?? []).forEach((c) => {
      const row = c as unknown as { id: string; name: string };
      convNameMap[row.id] = row.name;
    });
  }

  const documents = docs.map((d) => ({
    ...d,
    uploader_name: uploaderMap[d.uploaded_by] ?? "Unknown",
    conversation_name: d.conversation_id ? (convNameMap[d.conversation_id] ?? null) : null,
  }));

  return NextResponse.json({ success: true, documents });
}

const TEXT_MIME_PREFIXES = ["text/"];
const TEXT_MIME_EXACT = new Set(["application/json", "application/xml", "application/csv"]);
const CONTENT_CAP = 100_000; // chars

async function extractTextContent(buffer: ArrayBuffer, mimeType: string): Promise<string | null> {
  const mime = mimeType.toLowerCase();
  try {
    if (TEXT_MIME_PREFIXES.some((p) => mime.startsWith(p)) || TEXT_MIME_EXACT.has(mime)) {
      return new TextDecoder().decode(buffer).slice(0, CONTENT_CAP);
    }
    if (mime === "application/pdf") {
      // Use the inner lib path to avoid pdf-parse's top-level test-file initialization,
      // which crashes with a file-not-found error in the Next.js bundle.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (buf: Buffer) => Promise<{ text: string }>;
      const result = await pdfParse(Buffer.from(buffer));
      return result.text.slice(0, CONTENT_CAP);
    }
  } catch (err) {
    console.error(`[extractTextContent] failed for mime="${mimeType}":`, err);
  }
  return null;
}

// POST — upload a document (project-wide by default; pass conversationId field to scope it)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await authenticate(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;

  const { data: memberCheck } = await supabaseAdmin
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!memberCheck) return NextResponse.json({ success: false, error: "Not a project member" }, { status: 403 });

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > 20 * 1024 * 1024) {
    return NextResponse.json({ success: false, error: "File exceeds 20 MB limit" }, { status: 413 });
  }

  let formData: FormData;
  try { formData = await req.formData(); } catch {
    return NextResponse.json({ success: false, error: "Expected multipart form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });

  const conversationId = (formData.get("conversationId") as string | null) || null;

  // If conversationId provided, verify it belongs to this project
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

  const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ success: false, error: "File exceeds 20 MB limit" }, { status: 413 });
  }
  if (file.type) {
    const mimeErr = validateFileMime(file.type);
    if (mimeErr) return NextResponse.json({ success: false, error: mimeErr }, { status: 415 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._\-() ]/g, "_");
  const storagePath = `${projectId}/${Date.now()}-${safeName}`;

  const arrayBuffer = await file.arrayBuffer();

  const [uploadResult, textContent] = await Promise.all([
    supabaseAdmin.storage.from("documents").upload(storagePath, Buffer.from(arrayBuffer), {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    }),
    extractTextContent(arrayBuffer, file.type || ""),
  ]);

  if (uploadResult.error) {
    const msg = uploadResult.error.message.includes("Bucket not found")
      ? 'Storage bucket "documents" not found. Create it in the Supabase dashboard first.'
      : uploadResult.error.message;
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }

  const { data: docData, error: dbError } = await supabaseAdmin
    .from("documents")
    .insert({
      project_id: projectId,
      name: file.name,
      storage_path: storagePath,
      size_bytes: file.size,
      mime_type: file.type || null,
      content: textContent,
      content_length: textContent !== null ? textContent.length : null,
      uploaded_by: user.id,
      conversation_id: conversationId,
    } as never)
    .select()
    .single();

  if (dbError) {
    await supabaseAdmin.storage.from("documents").remove([storagePath]);
    return NextResponse.json({ success: false, error: dbError.message }, { status: 500 });
  }

  await supabaseAdmin.from("activity_log").insert({
    project_id: projectId,
    user_id: user.id,
    action: "uploaded_document",
    target_type: "document",
    target_name: file.name,
    target_id: (docData as unknown as { id: string }).id,
    metadata: conversationId
      ? { scope: "chat", conversation_id: conversationId, conversation_name: conversationName }
      : { scope: "project" },
  } as never);

  const { data: uploaderData } = await supabaseAdmin
    .from("users")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const document = {
    ...(docData as unknown as object),
    uploader_name: (uploaderData as unknown as { display_name: string } | null)?.display_name ?? "You",
    conversation_name: null,
  };

  return NextResponse.json({ success: true, document });
}
