import Link from "next/link";

export function Header() {
  return (
    <header className="h-14 border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-10 flex items-center px-8 shrink-0">
      <Link
        href="/"
        className="text-[26px] text-foreground tracking-[0.06em] select-none"
        style={{ fontFamily: "var(--font-cinzel)" }}
      >
        ELENCHUS
      </Link>

      <nav className="ml-10 hidden md:flex items-center gap-6 text-sm text-muted">
        <Link href="#how-it-works" className="hover:text-foreground transition-colors">
          How it works
        </Link>
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <Link href="/auth/login" className="text-sm text-muted hover:text-foreground transition-colors px-3 py-1.5">
          Sign in
        </Link>
        <Link href="/auth/signup" className="text-sm font-medium bg-foreground text-surface px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity">
          Get started
        </Link>
      </div>
    </header>
  );
}
