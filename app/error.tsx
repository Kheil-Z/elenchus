"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 text-center px-4 bg-background">
      <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center text-3xl select-none">
        ⚠️
      </div>
      <div>
        <p className="text-lg font-semibold text-foreground">Something went wrong</p>
        <p className="text-sm text-muted mt-1">An unexpected error occurred. Your data is safe.</p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-80 transition-opacity"
        >
          Try again
        </button>
        <a
          href="/projects"
          className="px-4 py-2 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-surface transition-colors"
        >
          Back to projects
        </a>
      </div>
    </div>
  );
}
