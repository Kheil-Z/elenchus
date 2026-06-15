import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("llm_provider, llm_api_key_encrypted")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Failed to fetch key status:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch status" }, { status: 500 });
  }

  const row = data as { llm_provider: string | null; llm_api_key_encrypted: string | null };
  const status = row.llm_api_key_encrypted ? "active" : "not_set";

  return NextResponse.json({ success: true, status, provider: row.llm_provider });
}
