import Link from "next/link";

export function Header() {
  return (
    <header className="h-14 border-b border-border bg-surface flex items-center px-6 shrink-0">
      <Link href="/" className="font-serif text-xl text-foreground tracking-tight">
        Elenchus
      </Link>
      <nav className="ml-auto flex items-center gap-4 text-sm text-muted">
        {/* nav items go here */}
      </nav>
    </header>
  );
}
