import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Server-side only. Add ENCRYPTION_KEY to .env.local:
//   ENCRYPTION_KEY=<64 hex chars — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
//
// Never import this file from client components.

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

// Returns "iv:ciphertext:authTag" (all hex).
export function encrypt(text: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${encrypted.toString("hex")}:${authTag.toString("hex")}`;
}

// Accepts the "iv:ciphertext:authTag" format produced by encrypt().
// Falls back to the raw value if it doesn't match that format — so that
// plaintext keys stored before encryption was added still work.
export function decrypt(value: string): string {
  const parts = value.split(":");
  if (parts.length !== 3) return value; // plaintext fallback

  try {
    const key = getKey();
    const ivHex = parts[0]!;
    const encHex = parts[1]!;
    const tagHex = parts[2]!;
    const iv = Buffer.from(ivHex, "hex");
    const enc = Buffer.from(encHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(enc).toString("utf8") + decipher.final("utf8");
  } catch {
    return value; // corrupt or plaintext — return as-is
  }
}
