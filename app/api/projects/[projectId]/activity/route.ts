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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await authenticate(req);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;

  // Verify membership
  const { data: memberCheck } = await supabaseAdmin
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!memberCheck) return NextResponse.json({ success: false, error: "Not a project member" }, { status: 403 });

  // Fetch last 50 activity events
  const { data: logData, error: logError } = await supabaseAdmin
    .from("activity_log")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (logError) return NextResponse.json({ success: false, error: logError.message }, { status: 500 });

  const logs = (logData ?? []) as unknown as Array<{
    id: string; user_id: string | null; action: string;
    target_type: string | null; target_name: string | null;
    target_id: string | null; created_at: string;
    metadata: Record<string, string> | null;
  }>;

  // Enrich with user display names
  const userIds = Array.from(new Set(logs.map((l) => l.user_id).filter(Boolean))) as string[];
  let userMap: Record<string, { display_name: string; color: string }> = {};

  if (userIds.length > 0) {
    const { data: usersData } = await supabaseAdmin
      .from("users")
      .select("id, display_name, color")
      .in("id", userIds);

    (usersData ?? []).forEach((u) => {
      const row = u as unknown as { id: string; display_name: string; color: string };
      userMap[row.id] = { display_name: row.display_name, color: row.color };
    });
  }

  const activity = logs.map((l) => ({
    ...l,
    user_name:  l.user_id ? (userMap[l.user_id]?.display_name ?? null) : null,
    user_color: l.user_id ? (userMap[l.user_id]?.color ?? null)         : null,
  }));

  return NextResponse.json({ success: true, activity });
}
