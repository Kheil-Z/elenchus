"use client";

import { useState, useRef } from "react";
import { Avatar } from "@/components/Avatar";
import type { ChatMember, ChatDocument } from "@/lib/chat-types";
import type { UserColor } from "@/lib/types";

const dotColor: Record<UserColor, string> = {
  blue:   "#3B82F6",
  green:  "#22C55E",
  purple: "#A855F7",
  coral:  "#F87171",
  amber:  "#F59E0B",
};

interface ChatSidebarProps {
  projectName: string;
  members: ChatMember[];
  documents: ChatDocument[];
  currentUserName?: string;
}

export function ChatSidebar({ projectName, members, documents, currentUserName }: ChatSidebarProps) {
  const [search, setSearch] = useState("");
  const [mentionsOnly, setMentionsOnly] = useState(false);

  const [addingMember, setAddingMember] = useState(false);
  const [inviteValue, setInviteValue] = useState("");

  const [docList, setDocList] = useState<ChatDocument[]>(documents);
  const docFileRef = useRef<HTMLInputElement>(null);

  function handleInvite() {
    setAddingMember(false);
    setInviteValue("");
  }

  function handleDocFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocList((prev) => [
      ...prev,
      { filename: file.name, uploader: "You", uploaderColor: "blue" },
    ]);
    e.target.value = "";
  }

  return (
    <aside className="w-60 border-l border-border bg-surface flex flex-col overflow-y-auto shrink-0">

      {/* Search + filters */}
      <div className="px-3 py-3 border-b border-border flex flex-col gap-2">
        <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-2.5 py-1.5 focus-within:border-foreground/20 transition-colors">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-muted shrink-0">
            <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M8 8l2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversation…"
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted/40 focus:outline-none min-w-0"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-muted/60 hover:text-foreground transition-colors leading-none shrink-0"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <button
          onClick={() => setMentionsOnly((v) => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors w-full text-left"
          style={
            mentionsOnly
              ? { backgroundColor: "rgba(59,130,246,0.1)", color: "#1D4ED8" }
              : { color: "var(--color-muted)" }
          }
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M6 3.5C4.6 3.5 3.5 4.6 3.5 6C3.5 7.4 4.6 8.5 6 8.5C7.4 8.5 8.5 7.9 8.5 6V5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="6" cy="6" r="1.2" fill="currentColor" />
          </svg>
          <span className="font-medium">My mentions</span>
          {mentionsOnly && (
            <span className="ml-auto text-[10px] font-semibold bg-blue-500 text-white rounded-full px-1.5 py-px leading-none">
              on
            </span>
          )}
        </button>
      </div>

      {/* Project */}
      <div className="px-4 py-4 border-b border-border">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/60 mb-2">
          Project
        </p>
        <span className="text-sm font-medium text-foreground">{projectName}</span>
      </div>

      {/* Members */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/60">
            Members
          </p>
          <button
            onClick={() => setAddingMember((v) => !v)}
            aria-label="Add member"
            title="Add member"
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-background transition-colors text-muted hover:text-foreground"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {members.map((m) => (
            <div key={m.name} className="flex items-start gap-2.5">
              <div className="relative shrink-0 mt-0.5">
                <Avatar name={m.name} color={m.color} size="sm" />
                <span
                  className="absolute bottom-0 right-0 w-2 h-2 rounded-full ring-2 ring-surface"
                  style={{ backgroundColor: m.online ? "#4ADE80" : "#D1D5DB" }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-1 mb-1">
                  <p className="text-xs font-medium text-foreground truncate">
                    {m.name}
                    {m.name === currentUserName && (
                      <span className="font-normal text-muted ml-1">— You</span>
                    )}
                  </p>
                  <span className="text-[11px] font-medium text-muted shrink-0">
                    {m.tokenPct}%
                  </span>
                </div>
                <div className="h-1 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${m.tokenPct}%`, backgroundColor: dotColor[m.color] }}
                  />
                </div>
                <p className="text-[10px] text-muted mt-0.5">{m.online ? "Online" : "Away"}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Invite form */}
        {addingMember && (
          <div className="mt-3 flex gap-1.5">
            <input
              autoFocus
              value={inviteValue}
              onChange={(e) => setInviteValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              placeholder="Name or email…"
              className="flex-1 text-xs bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none focus:border-foreground/30 placeholder:text-muted/40 min-w-0"
            />
            <button
              onClick={handleInvite}
              className="text-[11px] font-semibold bg-foreground text-surface px-2.5 py-1.5 rounded-md hover:opacity-80 transition-opacity shrink-0"
            >
              Invite
            </button>
          </div>
        )}
      </div>

      {/* Documents */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/60">
            Documents
          </p>
          <button
            onClick={() => docFileRef.current?.click()}
            aria-label="Upload document"
            title="Upload document"
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-background transition-colors text-muted hover:text-foreground"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <input
          ref={docFileRef}
          type="file"
          className="hidden"
          onChange={handleDocFile}
        />

        <div className="flex flex-col gap-2">
          {docList.map((doc, i) => (
            <div
              key={`${doc.filename}-${i}`}
              className="flex items-start gap-2 p-2 rounded-lg hover:bg-background cursor-pointer transition-colors"
            >
              <span className="text-sm mt-px" aria-hidden>📄</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{doc.filename}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: dotColor[doc.uploaderColor] }}
                  />
                  <span className="text-[10px] text-muted">{doc.uploader}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
