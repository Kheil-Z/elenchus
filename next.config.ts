import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Derive Supabase hostname for CSP connect-src
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
let supabaseHost = "*.supabase.co";
try {
  if (supabaseUrl) supabaseHost = new URL(supabaseUrl).hostname;
} catch {}

const cspDirectives = [
  "default-src 'self'",
  // Next.js App Router requires 'unsafe-inline' for hydration scripts.
  // 'unsafe-eval' is only needed by Turbopack's dev HMR runtime.
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}`,
  `img-src 'self' data: blob: https://${supabaseHost}`,
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(!isDev ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options",  value: "nosniff" },
  { key: "X-Frame-Options",         value: "DENY" },
  { key: "Referrer-Policy",         value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",      value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: cspDirectives },
  // HSTS only in production — localhost can't be HTTPS
  ...(!isDev
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
