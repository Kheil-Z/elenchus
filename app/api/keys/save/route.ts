import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { encrypt } from "@/lib/encrypt";
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

  let body: { apiKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const { apiKey } = body;
  if (!apiKey?.trim()) {
    return NextResponse.json({ success: false, error: "apiKey is required" }, { status: 400 });
  }
  if (!apiKey.trim().startsWith("sk-ant-")) {
    return NextResponse.json({
      success: false,
      error: "Invalid key format. Anthropic API keys start with sk-ant-",
    }, { status: 400 });
  }

  let encrypted: string;
  try {
    encrypted = encrypt(apiKey.trim());
  } catch (e) {
    console.error("encrypt error:", e);
    return NextResponse.json({ success: false, error: "Server configuration error" }, { status: 500 });
  }

  // Verify the user row exists in public.users before updating
  const { data: existingUser, error: lookupError } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (lookupError) {
    console.error("User lookup failed:", lookupError);
    return NextResponse.json({ success: false, error: `User lookup failed: ${lookupError.message}` }, { status: 500 });
  }
  if (!existingUser) {
    console.error("No public.users row for auth user", user.id);
    return NextResponse.json({
      success: false,
      error: "User profile not found — try signing out and back in",
    }, { status: 400 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("users")
    .update({ anthropic_api_key_encrypted: encrypted } as never)
    .eq("id", user.id);

  if (updateError) {
    console.error("Failed to save API key:", updateError);
    return NextResponse.json({
      success: false,
      error: `DB update failed: ${updateError.message}`,
    }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
