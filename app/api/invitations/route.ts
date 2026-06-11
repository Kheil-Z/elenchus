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

// GET — list pending invitations for the current user
export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("project_members")
    .select("id, project_id, invited_by_name, created_at, project:projects(id, name, description, emoji, created_at)")
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const invitations = (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      project_id: string;
      invited_by_name: string | null;
      created_at: string;
      project: { id: string; name: string; description: string | null; emoji: string | null; created_at: string } | null;
    };
    return {
      id: r.id,
      projectId: r.project_id,
      invitedByName: r.invited_by_name,
      createdAt: r.created_at,
      project: r.project,
    };
  }).filter((r) => r.project !== null);

  return NextResponse.json({ success: true, invitations });
}
