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
    .select("llm_provider, llm_api_key_encrypted, llm_custom_base_url, llm_custom_agent_name, llm_custom_model")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Failed to fetch key status:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch status" }, { status: 500 });
  }

  const row = data as {
    llm_provider: string | null;
    llm_api_key_encrypted: string | null;
    llm_custom_base_url: string | null;
    llm_custom_agent_name: string | null;
    llm_custom_model: string | null;
  };

  // A custom provider is "active" once its base URL is set — the key is optional
  const configured =
    !!row.llm_api_key_encrypted ||
    (row.llm_provider === "custom" && !!row.llm_custom_base_url);
  const status = configured ? "active" : "not_set";

  return NextResponse.json({
    success: true,
    status,
    provider: row.llm_provider,
    baseUrl: row.llm_custom_base_url ?? null,
    agentName: row.llm_custom_agent_name ?? null,
    model: row.llm_custom_model ?? null,
  });
}
