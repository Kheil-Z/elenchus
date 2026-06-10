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

  let body: { conversationId?: string; content?: string; authorDisplayName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const { conversationId, content, authorDisplayName } = body;
  if (!conversationId || !content?.trim()) {
    return NextResponse.json(
      { success: false, error: "conversationId and content are required" },
      { status: 400 }
    );
  }

  const { data: convData, error: convError } = await supabaseAdmin
    .from("conversations")
    .select("project_id")
    .eq("id", conversationId)
    .single();

  if (convError || !convData) {
    return NextResponse.json({ success: false, error: "Conversation not found" }, { status: 404 });
  }

  const { project_id } = convData as unknown as { project_id: string };

  const { data: memberData } = await supabaseAdmin
    .from("project_members")
    .select("id")
    .eq("project_id", project_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!memberData) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const insertRaw = await supabaseAdmin
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role: "user",
      content: content.trim(),
      author_user_id: user.id,
      author_display_name: authorDisplayName ?? "Unknown",
      caller_user_id: null,
      payer_user_id: null,
      model_used: null,
      input_tokens: 0,
      output_tokens: 0,
    } as never)
    .select()
    .single();

  if (insertRaw.error) {
    console.error("Failed to save message:", insertRaw.error);
    return NextResponse.json({ success: false, error: insertRaw.error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, messageId: (insertRaw.data as { id: string }).id });
}
