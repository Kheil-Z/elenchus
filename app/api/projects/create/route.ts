import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: string; description?: string; emoji?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const { name, description, emoji = "📁" } = body;
  if (!name?.trim()) {
    return NextResponse.json({ success: false, error: "Project name is required" }, { status: 400 });
  }

  const { data: projectData, error: projectError } = await supabaseAdmin
    .from("projects")
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      emoji,
      created_by: user.id,
    } as never)
    .select()
    .single();

  if (projectError || !projectData) {
    console.error("Failed to create project:", projectError);
    return NextResponse.json(
      { success: false, error: projectError?.message ?? "Failed to create project" },
      { status: 500 }
    );
  }

  const project = projectData as unknown as { id: string; name: string };

  const { error: memberError } = await supabaseAdmin
    .from("project_members")
    .insert({
      project_id: project.id,
      user_id: user.id,
      role: "can_edit",
    } as never);

  if (memberError) {
    console.error("Failed to add creator as member:", memberError);
    // Clean up orphaned project
    await supabaseAdmin.from("projects").delete().eq("id", project.id);
    return NextResponse.json(
      { success: false, error: `Could not add you as project member: ${memberError.message}` },
      { status: 500 }
    );
  }

  await supabaseAdmin.from("activity_log").insert({
    project_id: project.id,
    user_id: user.id,
    action: "created_project",
    target_type: "project",
    target_name: project.name,
    target_id: project.id,
  } as never);

  return NextResponse.json({ success: true, projectId: project.id });
}
