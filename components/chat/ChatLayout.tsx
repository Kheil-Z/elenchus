"use client";

import { useState } from "react";
import { ChatHeader } from "./ChatHeader";
import { LeftNav } from "@/components/LeftNav";

interface ChatLayoutProps {
  title: string;
  projectName: string;
  projectId?: string;
  children: React.ReactNode;
  sidebar: React.ReactNode;
  onRenameTitle?: (newName: string) => Promise<void>;
}

function lsGet(key: string, fallback: boolean): boolean {
  try { const v = localStorage.getItem(key); return v === null ? fallback : v !== "false"; } catch { return fallback; }
}
function lsSet(key: string, value: boolean) {
  try { localStorage.setItem(key, String(value)); } catch { /* */ }
}

export function ChatLayout({ title, projectName, projectId, children, sidebar, onRenameTitle }: ChatLayoutProps) {
  const [navOpen, setNavOpen] = useState(() => lsGet("elenchus:nav-open", true));
  const [sidebarOpen, setSidebarOpen] = useState(() => lsGet("elenchus:sidebar-open", true));

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Left nav — full height */}
      {navOpen && <LeftNav activeProjectId={projectId} />}

      {/* Main column */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <ChatHeader
          title={title}
          projectName={projectName}
          projectId={projectId}
          navOpen={navOpen}
          onToggleNav={() => setNavOpen((o) => { const next = !o; lsSet("elenchus:nav-open", next); return next; })}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((o) => { const next = !o; lsSet("elenchus:sidebar-open", next); return next; })}
          onRenameTitle={onRenameTitle}
        />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 flex flex-col overflow-hidden min-w-0">
            {children}
          </main>
          {sidebarOpen && sidebar}
        </div>
      </div>
    </div>
  );
}
