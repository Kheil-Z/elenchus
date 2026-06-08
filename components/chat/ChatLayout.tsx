"use client";

import { useState } from "react";
import { ChatHeader } from "./ChatHeader";

interface ChatLayoutProps {
  title: string;
  projectName: string;
  children: React.ReactNode;
  sidebar: React.ReactNode;
}

export function ChatLayout({ title, projectName, children, sidebar }: ChatLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <ChatHeader
        title={title}
        projectName={projectName}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
      />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {children}
        </main>
        {sidebarOpen && sidebar}
      </div>
    </div>
  );
}
