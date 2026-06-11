export type UserColor = "blue" | "green" | "purple" | "coral" | "amber" | "teal" | "rose" | "orange" | "indigo" | "sky" | "lime";

export const PROJECT_EMOJIS = [
  "📁", "🗂️", "💼", "🚀", "💡", "🔬", "📝", "🎯",
  "⚡", "🌱", "🏗️", "🎨", "📊", "🔒", "🤝", "🧪",
  "🌍", "🧠", "🎓", "🏆", "🔮", "🧩", "📡", "🛸",
  "🎪", "🌊", "🔥", "💎",
];

export interface ProjectMember {
  user_id: string;
  display_name: string;
  color: UserColor;
  role: "can_use" | "can_edit";
  online?: boolean;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  members?: ProjectMember[];
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  author_user_id?: string;
  author_display_name?: string;
  model_used?: string;
  input_tokens?: number;
  output_tokens?: number;
  created_at: string;
}

export interface Conversation {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
}

export type ResponseMode = "manual" | "smart" | "auto";

export type PayerStrategy =
  | "last_speaker"
  | "round_robin"
  | "host"
  | "designated"
  | "volunteer_pool";
