import Link from "next/link";

interface ChatHeaderProps {
  title: string;
  projectName: string;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export function ChatHeader({ title, projectName, sidebarOpen, onToggleSidebar }: ChatHeaderProps) {
  return (
    <header className="h-14 border-b border-border bg-surface flex items-center px-5 gap-3 shrink-0">
      <Link
        href="/"
        className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors shrink-0"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {projectName}
      </Link>

      <span className="text-border text-sm select-none">/</span>

      <h1 className="text-sm font-medium text-foreground flex-1 truncate">{title}</h1>

      {/* Sidebar toggle */}
      {onToggleSidebar && (
        <button
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background transition-colors shrink-0"
          style={{ color: sidebarOpen ? "var(--color-foreground)" : "var(--color-muted)" }}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <rect x="1" y="1.5" width="13" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
            <line x1="9.5" y1="1.5" x2="9.5" y2="13.5" stroke="currentColor" strokeWidth="1.2" />
            {sidebarOpen && (
              <path d="M11.5 6.5L12.5 7.5L11.5 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            )}
            {!sidebarOpen && (
              <path d="M12.5 6.5L11.5 7.5L12.5 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </button>
      )}

      <button
        aria-label="Settings"
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background transition-colors text-muted hover:text-foreground shrink-0"
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <path
            d="M7.5 9.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <path
            d="M12.2 9.2a1 1 0 0 0 .2 1.1l.04.04a1.2 1.2 0 0 1-1.7 1.7l-.04-.04a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V13a1.2 1.2 0 0 1-2.4 0v-.06a1 1 0 0 0-.65-.91 1 1 0 0 0-1.1.2l-.04.04a1.2 1.2 0 0 1-1.7-1.7l.04-.04a1 1 0 0 0 .2-1.1 1 1 0 0 0-.92-.6H2a1.2 1.2 0 0 1 0-2.4h.06a1 1 0 0 0 .91-.65 1 1 0 0 0-.2-1.1l-.04-.04a1.2 1.2 0 0 1 1.7-1.7l.04.04a1 1 0 0 0 1.1.2h.05A1 1 0 0 0 6.2 2V2a1.2 1.2 0 0 1 2.4 0v.06a1 1 0 0 0 .6.92 1 1 0 0 0 1.1-.2l.04-.04a1.2 1.2 0 0 1 1.7 1.7l-.04.04a1 1 0 0 0-.2 1.1v.05a1 1 0 0 0 .92.6H13a1.2 1.2 0 0 1 0 2.4h-.06a1 1 0 0 0-.74.57Z"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
      </button>
    </header>
  );
}
