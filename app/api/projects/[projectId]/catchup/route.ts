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

  // Verify membership + get display name for mention search
  const { data: memberData } = await supabaseAdmin
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!memberData) return NextResponse.json({ success: false, error: "Not a project member" }, { status: 403 });

  const { data: userData } = await supabaseAdmin
    .from("users")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const displayName = (userData as unknown as { display_name: string } | null)?.display_name ?? "";

  // Get last_seen_at (default to 7 days ago on first visit so there's something to show)
  const { data: stateData } = await supabaseAdmin
    .from("project_member_state")
    .select("last_seen_at")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .single();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const lastSeenAt = (stateData as unknown as { last_seen_at: string } | null)?.last_seen_at ?? sevenDaysAgo;

  // Get all conversation IDs in this project
  const { data: convsData } = await supabaseAdmin
    .from("conversations")
    .select("id, name")
    .eq("project_id", projectId);

  const convs = (convsData ?? []) as unknown as { id: string; name: string }[];
  const convIds = convs.map((c) => c.id);
  const convNameMap: Record<string, string> = {};
  convs.forEach((c) => { convNameMap[c.id] = c.name; });

  let mentions: unknown[] = [];
  let unread: unknown[] = [];

  if (convIds.length > 0) {
    // Mentions: messages containing @displayName since last_seen, not authored by self
    if (displayName) {
      const { data: mentionData } = await supabaseAdmin
        .from("messages")
        .select("id, content, author_display_name, author_user_id, conversation_id, created_at")
        .in("conversation_id", convIds)
        .ilike("content", `%@${displayName}%`)
        .gt("created_at", lastSeenAt)
        .neq("author_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      mentions = ((mentionData ?? []) as unknown as Array<{
        id: string; content: string; author_display_name: string;
        author_user_id: string | null; conversation_id: string; created_at: string;
      }>).map((m) => ({
        ...m,
        conversation_name: convNameMap[m.conversation_id] ?? "Unknown",
      }));
    }

    // Unread: conversations with messages after last_seen, not from self
    const { data: unreadData } = await supabaseAdmin
      .from("messages")
      .select("conversation_id, created_at")
      .in("conversation_id", convIds)
      .gt("created_at", lastSeenAt)
      .neq("author_user_id", user.id)
      .order("created_at", { ascending: false });

    const countMap: Record<string, number> = {};
    const latestMap: Record<string, string> = {};
    ((unreadData ?? []) as unknown as { conversation_id: string; created_at: string }[]).forEach((m) => {
      countMap[m.conversation_id] = (countMap[m.conversation_id] ?? 0) + 1;
      if (!latestMap[m.conversation_id]) latestMap[m.conversation_id] = m.created_at;
    });

    unread = Object.entries(countMap)
      .map(([convId, count]) => ({
        id: convId,
        name: convNameMap[convId] ?? "Unknown",
        new_count: count,
        latest_at: latestMap[convId],
      }))
      .sort((a, b) => (b.latest_at ?? "").localeCompare(a.latest_at ?? ""))
      .slice(0, 10);
  }

  // Update last_seen_at to now
  await supabaseAdmin
    .from("project_member_state")
    .upsert({ project_id: projectId, user_id: user.id, last_seen_at: new Date().toISOString() } as never);

  return NextResponse.json({ success: true, lastSeenAt, mentions, unread });
}
