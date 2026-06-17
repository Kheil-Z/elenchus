"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail]       = useState("");
  const [pending, setPending]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });

    // Always show the same message — never reveal whether the email exists
    setPending(false);
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="font-serif text-6xl text-foreground tracking-tight hover:opacity-80 transition-opacity">
            Elenchus
          </Link>
          <p className="text-sm text-muted mt-2">Reset your password</p>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-6">
          {submitted ? (
            <div className="flex flex-col gap-4 text-center">
              <div className="w-12 h-12 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto text-xl">
                ✉️
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Check your email</p>
                <p className="text-xs text-muted mt-1">
                  If an account exists for <span className="font-medium">{email}</span>, you'll receive a reset link shortly.
                </p>
              </div>
              <Link
                href="/auth/login"
                className="text-xs text-muted hover:text-foreground transition-colors"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <p className="text-xs text-muted">
                Enter the email address for your account and we'll send you a reset link.
              </p>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
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
                disabled={pending || !email.trim()}
                className="w-full py-2.5 rounded-xl text-sm font-medium transition-opacity disabled:opacity-50"
                style={{ backgroundColor: "var(--color-foreground)", color: "var(--color-background)" }}
              >
                {pending ? "Sending…" : "Send reset link"}
              </button>

              <Link
                href="/auth/login"
                className="text-center text-xs text-muted hover:text-foreground transition-colors"
              >
                Back to sign in
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
