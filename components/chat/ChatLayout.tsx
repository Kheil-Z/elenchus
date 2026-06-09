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

export function ChatLayout({ title, projectName, projectId, children, sidebar, onRenameTitle }: ChatLayoutProps) {
  const [navOpen, setNavOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
          onToggleNav={() => setNavOpen((o) => !o)}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((o) => !o)}
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
