import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 text-center px-4 bg-background">
      <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center text-3xl select-none">
        🔍
      </div>
      <div>
        <p className="text-4xl font-bold text-foreground tracking-tight">404</p>
        <p className="text-sm text-muted mt-2">This page doesn't exist or you don't have access to it.</p>
      </div>
      <Link
        href="/projects"
        className="px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-80 transition-opacity"
      >
        Back to projects
      </Link>
    </div>
  );
}
