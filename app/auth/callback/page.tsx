"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Landing page for Supabase email confirmation links.
// The Supabase JS client auto-exchanges the PKCE code on init; we just wait
// for SIGNED_IN, then send the user into the app.
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Catch the exchange completing after mount
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        router.replace("/projects");
      }
    });

    // Catch the case where the exchange completed before mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/projects");
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="w-5 h-5 border-2 border-border border-t-foreground rounded-full animate-spin" />
    </div>
  );
}
