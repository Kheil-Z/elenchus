import type { Metadata } from "next";
import { Instrument_Serif, DM_Sans, Cinzel } from "next/font/google";
import { cookies } from "next/headers";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "600"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Elenchus — Multiplayer AI",
  description: "A collaborative AI workspace. Multiple people, one shared thread, each using their own API key.",
};

function resolveDataTheme(pref: string | undefined): "light" | "dark" | undefined {
  if (pref === "light") return "light";
  if (pref === "dark") return "dark";
  return undefined; // "system" or missing — let the CSS media query handle it
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const themePref = cookieStore.get("elenchus-theme")?.value;
  const dataTheme = resolveDataTheme(themePref);

  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${dmSans.variable} ${cinzel.variable} h-full`}
      {...(dataTheme ? { "data-theme": dataTheme } : {})}
      suppressHydrationWarning
    >
      <head>
        {/* First-visit fallback: cookie not yet set, so server rendered no data-theme.
            Read localStorage (or OS preference) and patch before paint. */}
        {!dataTheme && (
          <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('elenchus-theme')||'system';if(t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.setAttribute('data-theme','dark');}else if(t==='light'){document.documentElement.setAttribute('data-theme','light');}})();` }} />
        )}
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
