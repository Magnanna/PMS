/**
 * Adapted from zoho-books-clone ("Zeno") src/lib/payments/crypto.ts (tested,
 * working there) — generic string encrypt/decrypt instead of Zeno's
 * JSON-config version, since our mpesa_credentials_per_org table stores
 * consumer key/secret/passkey as separate encrypted columns rather than one
 * JSON blob (US-C10, NFR-2). See docs/PORTED.md.
 */
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.MPESA_CREDENTIALS_ENC_KEY;
  if (!key) {
    throw new Error("Missing MPESA_CREDENTIALS_ENC_KEY in environment variables");
  }
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) {
    throw new Error("MPESA_CREDENTIALS_ENC_KEY must be a 32-byte base64 string");
  }
  return buf;
}

/** Encrypts a single secret string. Format: iv:authTag:ciphertext (all hex). */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getKey();

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/** Throws on a malformed/tampered ciphertext rather than silently returning
 *  garbage — a corrupted M-Pesa secret must fail loudly, not post a
 *  mis-signed STK push. */
export function decryptSecret(encryptedStr: string): string {
  const parts = encryptedStr.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted secret");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const key = getKey();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
