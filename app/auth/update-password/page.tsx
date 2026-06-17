"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const MIN_PASSWORD_LENGTH = 8;

export default function UpdatePasswordPage() {
  const router = useRouter();

  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [pending, setPending]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [checking, setChecking]   = useState(true);

  // Supabase fires PASSWORD_RECOVERY when the user lands from the reset email link.
  // The recovery token in the URL hash is exchanged for a session automatically.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true);
        setChecking(false);
      }
    });

    // Also check if there's already a valid session (e.g. page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true);
      }
      setChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setPending(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await supabase.auth.signOut();
    router.replace("/auth/login?reset=success");
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted">Verifying reset link…</p>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center flex flex-col gap-4">
          <p className="text-sm font-medium text-foreground">Reset link expired or invalid</p>
          <p className="text-xs text-muted">Password reset links expire after 1 hour.</p>
          <Link
            href="/auth/forgot-password"
            className="text-sm font-medium text-foreground hover:underline"
          >
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="font-serif text-6xl text-foreground tracking-tight hover:opacity-80 transition-opacity">
            Elenchus
          </Link>
          <p className="text-sm text-muted mt-2">Choose a new password</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`Min. ${MIN_PASSWORD_LENGTH} characters`}
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-foreground/30 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">Confirm new password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat password"
              autoComplete="new-password"
              required
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-foreground/30 transition-colors"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || !password || !confirm}
            className="w-full py-2.5 rounded-xl text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "var(--color-foreground)", color: "var(--color-background)" }}
          >
            {pending ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
