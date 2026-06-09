import { supabase } from "@/lib/supabase";
import type {
  Project,
  ProjectMember,
  ProjectRole,
  Conversation,
  Message,
  User,
  ClaudeMode,
  PayerMode,
} from "@/lib/types/database";

// ─── Result type ─────────────────────────────────────────────────────────────

type Result<T> = { data: T; error: null } | { data: null; error: string };

// Supabase v2 type inference requires Views/Functions/Enums/Relationships fields
// that our hand-written Database type omits. Cast results explicitly so the call
// sites stay clean.
function ok<T>(raw: { data: unknown; error: unknown }): Result<T> {
  if (raw.error) return { data: null, error: (raw.error as { message: string }).message };
  return { data: raw.data as T, error: null };
}

// ─── Internal helper ─────────────────────────────────────────────────────────

async function isProjectMember(projectId: string, userId: string): Promise<boolean> {
  const raw = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  return raw.data !== null;
}

// ─── Projects ────────────────────────────────────────────────────────────────

export const getProjects = async (userId: string): Promise<Result<Project[]>> => {
  try {
    const memberRaw = await supabase
      .from("project_members")
      .select("project_id")
      .eq("user_id", userId);

    if (memberRaw.error) return { data: null, error: memberRaw.error.message };

    const projectIds = (memberRaw.data as { project_id: string }[]).map((r) => r.project_id);
    if (projectIds.length === 0) return { data: [], error: null };

    const raw = await supabase
      .from("projects")
      .select("*")
      .in("id", projectIds)
      .order("created_at", { ascending: false });

    return ok<Project[]>(raw);
  } catch (err) {
    console.error("getProjects error:", err);
    return { data: null, error: String(err) };
  }
};

export const getProject = async (
  projectId: string,
  userId: string
): Promise<Result<Project>> => {
  try {
    const raw = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (raw.error) return { data: null, error: raw.error.message };

    const member = await isProjectMember(projectId, userId);
    if (!member) return { data: null, error: "Unauthorized" };

    return { data: raw.data as Project, error: null };
  } catch (err) {
    console.error("getProject error:", err);
    return { data: null, error: String(err) };
  }
};

export const createProject = async (
  userId: string,
  name: string,
  description: string | null = null
): Promise<Result<Project>> => {
  try {
    const projectRaw = await supabase
      .from("projects")
      .insert({ name, description, created_by: userId } as never)
      .select()
      .single();

    if (projectRaw.error) return { data: null, error: projectRaw.error.message };
    const project = projectRaw.data as Project;

    const memberRaw = await supabase
      .from("project_members")
      .insert({ project_id: project.id, user_id: userId, role: "can_edit" } as never);

    if (memberRaw.error) return { data: null, error: memberRaw.error.message };

    return { data: project, error: null };
  } catch (err) {
    console.error("createProject error:", err);
    return { data: null, error: String(err) };
  }
};

export const updateProject = async (
  projectId: string,
  updates: { name?: string; description?: string | null }
): Promise<Result<Project>> => {
  try {
    const raw = await supabase
      .from("projects")
      .update(updates as never)
      .eq("id", projectId)
      .select()
      .single();

    return ok<Project>(raw);
  } catch (err) {
    console.error("updateProject error:", err);
    return { data: null, error: String(err) };
  }
};

export const deleteProject = async (
  projectId: string,
  userId: string
): Promise<Result<null>> => {
  try {
    const checkRaw = await supabase
      .from("projects")
      .select("created_by")
      .eq("id", projectId)
      .single();

    if (checkRaw.error) return { data: null, error: checkRaw.error.message };
    const row = checkRaw.data as Pick<Project, "created_by">;
    if (row.created_by !== userId) return { data: null, error: "Only the project creator can delete it" };

    const raw = await supabase.from("projects").delete().eq("id", projectId);
    if (raw.error) return { data: null, error: raw.error.message };
    return { data: null, error: null };
  } catch (err) {
    console.error("deleteProject error:", err);
    return { data: null, error: String(err) };
  }
};

// ─── Project Members ─────────────────────────────────────────────────────────

export type ProjectMemberWithUser = ProjectMember & {
  user: Pick<User, "display_name" | "color" | "email">;
};

export const getProjectMembers = async (
  projectId: string,
  userId: string
): Promise<Result<ProjectMemberWithUser[]>> => {
  try {
    const member = await isProjectMember(projectId, userId);
    if (!member) return { data: null, error: "Unauthorized" };

    const raw = await supabase
      .from("project_members")
      .select("*, user:users(display_name, color, email)")
      .eq("project_id", projectId);

    return ok<ProjectMemberWithUser[]>(raw);
  } catch (err) {
    console.error("getProjectMembers error:", err);
    return { data: null, error: String(err) };
  }
};

export const addProjectMember = async (
  projectId: string,
  email: string,
  role: ProjectRole = "can_use"
): Promise<Result<ProjectMember>> => {
  try {
    const userRaw = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (userRaw.error) return { data: null, error: userRaw.error.message };
    if (!userRaw.data) return { data: null, error: `No user found with email ${email}` };
    const userId = (userRaw.data as Pick<User, "id">).id;

    const raw = await supabase
      .from("project_members")
      .insert({ project_id: projectId, user_id: userId, role } as never)
      .select()
      .single();

    return ok<ProjectMember>(raw);
  } catch (err) {
    console.error("addProjectMember error:", err);
    return { data: null, error: String(err) };
  }
};

export const removeProjectMember = async (
  projectId: string,
  memberId: string
): Promise<Result<null>> => {
  try {
    const raw = await supabase
      .from("project_members")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", memberId);

    if (raw.error) return { data: null, error: raw.error.message };
    return { data: null, error: null };
  } catch (err) {
    console.error("removeProjectMember error:", err);
    return { data: null, error: String(err) };
  }
};

// ─── Conversations ────────────────────────────────────────────────────────────

export const getConversations = async (
  projectId: string,
  userId: string
): Promise<Result<Conversation[]>> => {
  try {
    const member = await isProjectMember(projectId, userId);
    if (!member) return { data: null, error: "Unauthorized" };

    const raw = await supabase
      .from("conversations")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    return ok<Conversation[]>(raw);
  } catch (err) {
    console.error("getConversations error:", err);
    return { data: null, error: String(err) };
  }
};

export const getConversation = async (
  conversationId: string,
  userId: string
): Promise<Result<Conversation>> => {
  try {
    const raw = await supabase
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .single();

    if (raw.error) return { data: null, error: raw.error.message };
    const conv = raw.data as Conversation;

    const member = await isProjectMember(conv.project_id, userId);
    if (!member) return { data: null, error: "Unauthorized" };

    return { data: conv, error: null };
  } catch (err) {
    console.error("getConversation error:", err);
    return { data: null, error: String(err) };
  }
};

export const createConversation = async (
  projectId: string,
  userId: string,
  name: string
): Promise<Result<Conversation>> => {
  try {
    const raw = await supabase
      .from("conversations")
      .insert({
        project_id: projectId,
        creator_user_id: userId,
        name,
        claude_mode: "manual" as ClaudeMode,
        payer_mode: "last_speaker" as PayerMode,
        designated_payer_id: null,
        token_budget: null,
        hard_stop: false,
      } as never)
      .select()
      .single();

    if (raw.error) return { data: null, error: raw.error.message };
    const conv = raw.data as Conversation;

    await supabase
      .from("conversation_members")
      .insert({ conversation_id: conv.id, user_id: userId } as never);

    return { data: conv, error: null };
  } catch (err) {
    console.error("createConversation error:", err);
    return { data: null, error: String(err) };
  }
};

export const updateConversation = async (
  conversationId: string,
  updates: {
    name?: string;
    claude_mode?: ClaudeMode;
    payer_mode?: PayerMode;
    designated_payer_id?: string | null;
    token_budget?: number | null;
    hard_stop?: boolean;
  }
): Promise<Result<Conversation>> => {
  try {
    const raw = await supabase
      .from("conversations")
      .update(updates as never)
      .eq("id", conversationId)
      .select()
      .single();

    return ok<Conversation>(raw);
  } catch (err) {
    console.error("updateConversation error:", err);
    return { data: null, error: String(err) };
  }
};

// ─── Messages ─────────────────────────────────────────────────────────────────

export const getMessages = async (
  conversationId: string,
  userId: string
): Promise<Result<Message[]>> => {
  try {
    const convRaw = await supabase
      .from("conversations")
      .select("project_id")
      .eq("id", conversationId)
      .single();

    if (convRaw.error) return { data: null, error: convRaw.error.message };
    const { project_id } = convRaw.data as Pick<Conversation, "project_id">;

    const member = await isProjectMember(project_id, userId);
    if (!member) return { data: null, error: "Unauthorized" };

    const raw = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    return ok<Message[]>(raw);
  } catch (err) {
    console.error("getMessages error:", err);
    return { data: null, error: String(err) };
  }
};

export const addMessage = async (
  conversationId: string,
  message: Omit<Message, "id" | "created_at" | "conversation_id">
): Promise<Result<Message>> => {
  try {
    const raw = await supabase
      .from("messages")
      .insert({ ...message, conversation_id: conversationId } as never)
      .select()
      .single();

    return ok<Message>(raw);
  } catch (err) {
    console.error("addMessage error:", err);
    return { data: null, error: String(err) };
  }
};

export const subscribeToMessages = (
  conversationId: string,
  callback: (message: Message) => void
) => {
  return supabase
    .channel(`messages:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        callback(payload.new as Message);
      }
    )
    .subscribe();
};

// ─── Users ────────────────────────────────────────────────────────────────────

export const getUserProfile = async (userId: string): Promise<Result<User>> => {
  try {
    const raw = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    return ok<User>(raw);
  } catch (err) {
    console.error("getUserProfile error:", err);
    return { data: null, error: String(err) };
  }
};

export const updateUserProfile = async (
  userId: string,
  updates: { display_name?: string; color?: string }
): Promise<Result<User>> => {
  try {
    const raw = await supabase
      .from("users")
      .update(updates as never)
      .eq("id", userId)
      .select()
      .single();

    return ok<User>(raw);
  } catch (err) {
    console.error("updateUserProfile error:", err);
    return { data: null, error: String(err) };
  }
};
