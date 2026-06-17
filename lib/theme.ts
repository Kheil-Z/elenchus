export type ThemePreference = "light" | "dark" | "system";

const COOKIE = "elenchus-theme";
const LS_KEY = "elenchus-theme";

export function getThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem(LS_KEY) as ThemePreference) ?? "system";
}

export function setThemePreference(pref: ThemePreference) {
  localStorage.setItem(LS_KEY, pref);
  // Write cookie so the server can read it on next request (1 year, SameSite=Lax)
  document.cookie = `${COOKIE}=${pref};path=/;max-age=31536000;SameSite=Lax`;
  applyTheme(pref);
}

export function applyTheme(pref: ThemePreference) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}
