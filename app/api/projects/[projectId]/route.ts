import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { LIMITS, capLength } from "@/lib/validate";
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

// PUT /api/projects/[projectId] — rename / update emoji / description
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await authenticate(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;

  let body: { name?: string; description?: string | null; emoji?: string; system_prompt?: string | null };
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: "Invalid body" }, { status: 400 });
  }

  // Must be a can_edit member
  const { data: memberData } = await supabaseAdmin
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  const member = memberData as unknown as { role: string } | null;
  if (!member || member.role !== "can_edit") {
    return NextResponse.json({ success: false, error: "Only editors can rename this project" }, { status: 403 });
  }

  const updates: Record<string, string | null> = {};
  if (body.name?.trim()) {
    const nameErr = capLength(body.name.trim(), LIMITS.projectName, "Project name");
    if (nameErr) return NextResponse.json({ success: false, error: nameErr }, { status: 400 });
    updates.name = body.name.trim();
  }
  if (body.description !== undefined) {
    if (body.description) {
      const descErr = capLength(body.description.trim(), LIMITS.projectDescription, "Description");
      if (descErr) return NextResponse.json({ success: false, error: descErr }, { status: 400 });
    }
    updates.description = body.description ?? null;
  }
  if (body.emoji) updates.emoji = body.emoji;
  if (body.system_prompt !== undefined) {
    if (body.system_prompt && body.system_prompt.trim().length > 4000) {
      return NextResponse.json({ success: false, error: "System prompt must be 4000 characters or fewer" }, { status: 400 });
    }
    updates.system_prompt = body.system_prompt ? body.system_prompt.trim() : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("projects")
    .update(updates as never)
    .eq("id", projectId)
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  if (updates.name) {
    await supabaseAdmin.from("activity_log").insert({
      project_id: projectId,
      user_id: user.id,
      action: "renamed_project",
      target_type: "project",
      target_name: updates.name,
      target_id: projectId,
    } as never);
  }
  if ("system_prompt" in updates) {
    const newPrompt = updates.system_prompt;
    await supabaseAdmin.from("activity_log").insert({
      project_id: projectId,
      user_id: user.id,
      action: newPrompt ? "updated_system_prompt" : "reset_system_prompt",
      target_type: "project",
      target_name: newPrompt ? (newPrompt.length > 60 ? newPrompt.slice(0, 59) + "…" : newPrompt) : null,
      target_id: projectId,
    } as never);
  }

  return NextResponse.json({ success: true, project: data });
}

// DELETE /api/projects/[projectId] — permanently delete (creator only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await authenticate(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;

  const { data: projectData } = await supabaseAdmin
    .from("projects")
    .select("created_by")
    .eq("id", projectId)
    .single();

  const project = projectData as unknown as { created_by: string } | null;
  if (!project) return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  if (project.created_by !== user.id) {
    return NextResponse.json({ success: false, error: "Only the project creator can delete it" }, { status: 403 });
  }

  // Cascade deletes project_members, conversations, messages via FK constraints
  const { error } = await supabaseAdmin.from("projects").delete().eq("id", projectId);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
