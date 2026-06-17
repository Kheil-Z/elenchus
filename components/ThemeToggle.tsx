"use client";

import { useEffect, useState } from "react";
import { getThemePreference, setThemePreference, applyTheme } from "@/lib/theme";
import type { ThemePreference } from "@/lib/theme";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light",  label: "Light"  },
  { value: "system", label: "System" },
  { value: "dark",   label: "Dark"   },
];

export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePreference>("system");

  useEffect(() => {
    const pref = getThemePreference();
    setPref(pref);
    applyTheme(pref); // Re-apply after hydration in case the anti-FOUC attribute was lost
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => { if (getThemePreference() === "system") applyTheme("system"); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  function choose(value: ThemePreference) {
    setPref(value);
    setThemePreference(value);
  }

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-2" style={{ opacity: 0.5 }}>
        Appearance
      </p>
      <div className="flex items-center rounded-lg border overflow-hidden text-[11px]" style={{ borderColor: "var(--color-border)" }}>
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => choose(opt.value)}
            className="flex-1 py-1.5 font-medium transition-colors"
            style={
              pref === opt.value
                ? { backgroundColor: "var(--color-foreground)", color: "var(--color-background)" }
                : { color: "var(--color-muted)" }
            }
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
