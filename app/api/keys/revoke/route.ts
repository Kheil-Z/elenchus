import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabaseAdmin
    .from("users")
    .update({
      llm_provider:          null,
      llm_api_key_encrypted: null,
      llm_custom_base_url:   null,
      llm_custom_agent_name: null,
      llm_custom_model:      null,
    } as never)
    .eq("id", user.id);

  if (error) {
    console.error("Failed to revoke API key:", error);
    return NextResponse.json({ success: false, error: "Failed to revoke API key" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
