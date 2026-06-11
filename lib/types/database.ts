// TypeScript types mirroring the Supabase schema.
// These are plain types used throughout the app — not Supabase-generated.

export interface User {
  id: string;
  email: string;
  display_name: string;
  color: string;
  /** Encrypted server-side; never returned to the client in plaintext. */
  anthropic_api_key_encrypted?: string;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  emoji: string;
  created_by: string;
  created_at: string;
}

export type ProjectRole = "can_use" | "can_edit";

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  created_at: string;
}

export type ClaudeMode = "manual" | "smart" | "auto";
export type PayerMode  = "last_speaker" | "round_robin" | "host" | "designated";

export interface Conversation {
  id: string;
  project_id: string;
  name: string;
  creator_user_id: string;
  claude_mode: ClaudeMode;
  payer_mode: PayerMode;
  designated_payer_id: string | null;
  token_budget: number | null;
  hard_stop: boolean;
  created_at: string;
}

export interface ConversationMember {
  id: string;
  conversation_id: string;
  user_id: string;
  created_at: string;
}

export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  author_user_id: string | null;      // null for assistant messages
  author_display_name: string;
  caller_user_id: string | null;      // who typed @claude
  payer_user_id: string | null;       // whose API key was charged
  model_used: string | null;
  input_tokens: number;
  output_tokens: number;
  created_at: string;
}

export interface Document {
  id: string;
  project_id: string;
  name: string;
  storage_path: string;
  size_bytes: number;
  mime_type: string | null;
  uploaded_by: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  project_id: string;
  user_id: string | null;
  action: string;
  target_type: string | null;
  target_name: string | null;
  target_id: string | null;
  created_at: string;
}

export interface ProjectMemberState {
  project_id: string;
  user_id: string;
  last_seen_at: string;
}

// ─── Supabase Database shape (used to type the Supabase client) ───────────────

export type Database = {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, "created_at"> & { created_at?: string };
        Update: Partial<Omit<User, "id">>;
      };
      projects: {
        Row: Project;
        Insert: Omit<Project, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<Project, "id">>;
      };
      project_members: {
        Row: ProjectMember;
        Insert: Omit<ProjectMember, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<ProjectMember, "id">>;
      };
      conversations: {
        Row: Conversation;
        Insert: Omit<Conversation, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<Conversation, "id">>;
      };
      conversation_members: {
        Row: ConversationMember;
        Insert: Omit<ConversationMember, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<ConversationMember, "id">>;
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<Message, "id">>;
      };
      documents: {
        Row: Document;
        Insert: Omit<Document, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<Document, "id">>;
      };
      activity_log: {
        Row: ActivityLog;
        Insert: Omit<ActivityLog, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<ActivityLog, "id">>;
      };
      project_member_state: {
        Row: ProjectMemberState;
        Insert: ProjectMemberState;
        Update: Partial<ProjectMemberState>;
      };
    };
  };
};
