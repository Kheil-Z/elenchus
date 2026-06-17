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

// GET — return signed preview + download URLs for a document
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const user = await authenticate(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { documentId } = await params;

  const { data: doc } = await supabaseAdmin
    .from("documents")
    .select("project_id, name, storage_path, size_bytes, mime_type, uploaded_by, created_at")
    .eq("id", documentId)
    .single();

  if (!doc) return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });

  const d = doc as unknown as {
    project_id: string; name: string; storage_path: string;
    size_bytes: number; mime_type: string | null; uploaded_by: string; created_at: string;
  };

  // Must be a project member
  const { data: member } = await supabaseAdmin
    .from("project_members")
    .select("user_id")
    .eq("project_id", d.project_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!member) return NextResponse.json({ success: false, error: "Not a project member" }, { status: 403 });

  const TTL = 60 * 60; // 1 hour

  const [
    { data: previewData, error: prevErr },
    { data: dlData,      error: dlErr   },
    { data: uploaderProfile },
  ] = await Promise.all([
    supabaseAdmin.storage.from("documents").createSignedUrl(d.storage_path, TTL),
    supabaseAdmin.storage.from("documents").createSignedUrl(d.storage_path, TTL, { download: d.name }),
    supabaseAdmin.from("users").select("display_name").eq("id", d.uploaded_by).single(),
  ]);

  if (prevErr || dlErr || !previewData || !dlData) {
    return NextResponse.json({ success: false, error: "Failed to generate signed URL" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    previewUrl: previewData.signedUrl,
    downloadUrl: dlData.signedUrl,
    name: d.name,
    sizeBytes: d.size_bytes,
    mimeType: d.mime_type,
    uploaderName: (uploaderProfile as unknown as { display_name: string } | null)?.display_name ?? "Unknown",
    createdAt: d.created_at,
  });
}
