import Link from "next/link";

const MY_PROJECTS = [
  { id: "test", name: "Product Redesign",  emoji: "🎨" },
  { id: "p2",   name: "API Documentation", emoji: "📝" },
];

const JOINED_PROJECTS = [
  { id: "p3", name: "Q4 Planning",      emoji: "📊" },
  { id: "p4", name: "Brand Guidelines", emoji: "🎯" },
];

export function LeftNav({ activeProjectId }: { activeProjectId?: string }) {
  return (
    <nav className="w-52 border-r border-border bg-surface flex flex-col shrink-0 overflow-y-auto">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-border shrink-0">
        <Link
          href="/"
          className="font-serif text-xl text-foreground tracking-tight hover:opacity-80 transition-opacity"
        >
          Elenchus
        </Link>
      </div>

      {/* New project */}
      <div className="px-3 pt-4 pb-2">
        <button className="w-full flex items-center gap-2 text-xs font-medium text-foreground bg-background border border-border rounded-lg px-3 py-2 hover:border-foreground/20 transition-colors">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          New project
        </button>
      </div>

      {/* My projects */}
      <div className="px-3 pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/50 px-2 mb-1.5">
          My projects
        </p>
        {MY_PROJECTS.map((p) => (
          <Link
            key={p.id}
            href={`/project/${p.id}`}
            className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors"
            style={
              p.id === activeProjectId
                ? { backgroundColor: "var(--color-background)", color: "var(--color-foreground)", fontWeight: 500 }
                : { color: "var(--color-muted)" }
            }
          >
            <span className="text-base leading-none shrink-0">{p.emoji}</span>
            <span className="truncate">{p.name}</span>
          </Link>
        ))}
      </div>

      {/* Projects I'm in */}
      <div className="px-3 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/50 px-2 mb-1.5">
          Projects I&apos;m in
        </p>
        {JOINED_PROJECTS.map((p) => (
          <Link
            key={p.id}
            href={`/project/${p.id}`}
            className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors"
            style={
              p.id === activeProjectId
                ? { backgroundColor: "var(--color-background)", color: "var(--color-foreground)", fontWeight: 500 }
                : { color: "var(--color-muted)" }
            }
          >
            <span className="text-base leading-none shrink-0">{p.emoji}</span>
            <span className="truncate">{p.name}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
