// Server-side input validation helpers used across API routes.

export const LIMITS = {
  projectName:       100,
  projectDescription:500,
  conversationName:  100,
  messageContent:    50_000,
  email:             254,   // RFC 5321 maximum
  apiKey:            300,
  emoji:             10,
  displayName:       80,
};

export function capLength(value: string, max: number, label: string): string | null {
  if (value.length > max) return `${label} must be ${max} characters or fewer`;
  return null;
}

// Very basic email sanity check — not RFC-complete, just catches clear non-emails
export function validateEmail(email: string): string | null {
  if (email.length > LIMITS.email) return `Email must be ${LIMITS.email} characters or fewer`;
  if (!email.includes("@") || !email.includes(".")) return "Invalid email address";
  return null;
}

// Dangerous MIME types that must never be stored and served back to browsers
const BLOCKED_MIME_TYPES = new Set([
  "text/html",
  "application/javascript",
  "application/x-javascript",
  "text/javascript",
  "application/x-sh",
  "application/x-bash",
  "application/x-csh",
  "application/x-executable",
  "application/x-msdos-program",
  "application/x-msdownload",
]);

export function validateFileMime(mimeType: string): string | null {
  if (BLOCKED_MIME_TYPES.has(mimeType.toLowerCase())) {
    return `File type "${mimeType}" is not allowed`;
  }
  return null;
}
