import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return (e as { message: string }).message;
  if (e instanceof Error) return e.message;
  return JSON.stringify(e);
}

function fail(step: string, error: unknown) {
  console.error(`[account/delete] step="${step}"`, error);
  return NextResponse.json({ error: `Deletion failed at "${step}": ${errMsg(error)}` }, { status: 500 });
}

export async function DELETE(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 1. Find projects this user created.
  const { data: ownedProjects, error: e1 } = await supabaseAdmin
    .from("projects").select("id").eq("created_by", user.id);
  if (e1) return fail("fetch owned projects", e1);
  const projectIds = (ownedProjects ?? []).map((p) => (p as unknown as { id: string }).id);

  // 2. Collect storage paths for files in owned projects before rows are deleted.
  if (projectIds.length > 0) {
    const { data: docRows, error: e2 } = await supabaseAdmin
      .from("documents").select("storage_path").in("project_id", projectIds);
    if (e2) return fail("fetch storage paths", e2);

    const paths = (docRows ?? [])
      .map((d) => (d as unknown as { storage_path: string }).storage_path)
      .filter(Boolean);
    if (paths.length > 0) {
      const { error: e3 } = await supabaseAdmin.storage.from("documents").remove(paths);
      if (e3) return fail("delete storage files", e3);
    }
  }

  // 3. Null out FK columns that ARE nullable in both old and new schema.
  const nullResults = await Promise.all([
    supabaseAdmin.from("messages").update({ author_user_id: null } as never).eq("author_user_id", user.id),
    supabaseAdmin.from("messages").update({ caller_user_id: null } as never).eq("caller_user_id", user.id),
    supabaseAdmin.from("messages").update({ payer_user_id:  null } as never).eq("payer_user_id",  user.id),
    supabaseAdmin.from("conversations").update({ designated_payer_id: null } as never).eq("designated_payer_id", user.id),
  ]);
  const nullErr = nullResults.find((r) => r.error)?.error;
  if (nullErr) return fail("null FK references", nullErr);

  // 4. Handle conversations.creator_user_id — NOT NULL in the old DB so we can't null
  //    it. Instead, reassign any conversations this user created in other people's
  //    projects to the project's creator. In the new DB this is handled automatically
  //    by ON DELETE SET NULL.
  const { data: createdConvs, error: e4 } = await supabaseAdmin
    .from("conversations")
    .select("id, project_id")
    .eq("creator_user_id", user.id);
  if (e4) return fail("fetch created conversations", e4);

  // Only the ones NOT in owned projects (owned projects are deleted wholesale in step 5)
  const guestConvs = (createdConvs ?? []).filter(
    (c) => !projectIds.includes((c as unknown as { project_id: string }).project_id)
  );

  for (const conv of guestConvs) {
    const c = conv as unknown as { id: string; project_id: string };
    const { data: proj } = await supabaseAdmin
      .from("projects").select("created_by").eq("id", c.project_id).single();
    const newOwner = (proj as unknown as { created_by: string } | null)?.created_by;
    if (newOwner) {
      const { error: e5 } = await supabaseAdmin
        .from("conversations")
        .update({ creator_user_id: newOwner } as never)
        .eq("id", c.id);
      if (e5) return fail("reassign conversation creator", e5);
    }
  }

  // 5. Delete owned projects — cascades to conversations, messages, documents,
  //    project_members, and activity_log rows within those projects.
  if (projectIds.length > 0) {
    const { error: e6 } = await supabaseAdmin.from("projects").delete().in("id", projectIds);
    if (e6) return fail("delete owned projects", e6);
  }

  // 6. Delete the auth user — cascades to public.users, then to project_members
  //    in projects this user belonged to but didn't own.
  const { error: e7 } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (e7) return fail("delete auth user", e7);

  return NextResponse.json({ success: true });
}
