import { describe, expect, it } from "vitest";
import { createSignedToken, verifySignedToken } from "../signed-token";

const SECRET = "test-secret-32-bytes-minimum-ok!";
const OTHER_SECRET = "a-completely-different-secret!!";

describe("createSignedToken / verifySignedToken", () => {
  it("round-trips a valid token", () => {
    const token = createSignedToken("invoice-123", 60_000, SECRET);
    expect(verifySignedToken(token, SECRET)).toBe("invoice-123");
  });

  it("rejects a token past its expiry (negative case)", () => {
    const token = createSignedToken("invoice-123", 1000, SECRET);
    const future = Date.now() + 2000;
    expect(verifySignedToken(token, SECRET, future)).toBeNull();
  });

  it("accepts a token exactly at its expiry boundary", () => {
    const now = Date.now();
    const ttl = 1000;
    const token = createSignedToken("invoice-123", ttl, SECRET);
    // now + ttl is the expiresAt instant baked into the token; verifying at
    // that exact instant should still pass ("now > expiresAt" is the cutoff).
    expect(verifySignedToken(token, SECRET, now + ttl)).toBe("invoice-123");
  });

  it("rejects a token signed with a different secret (tamper/forgery case)", () => {
    const token = createSignedToken("invoice-123", 60_000, SECRET);
    expect(verifySignedToken(token, OTHER_SECRET)).toBeNull();
  });

  it("rejects a token with a tampered subject (signature no longer matches)", () => {
    const token = createSignedToken("invoice-123", 60_000, SECRET);
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [, expiresAt, sig] = decoded.split(".");
    const forged = Buffer.from(`invoice-999.${expiresAt}.${sig}`).toString("base64url");
    expect(verifySignedToken(forged, SECRET)).toBeNull();
  });

  it("rejects garbage input without throwing", () => {
    expect(verifySignedToken("not-a-real-token", SECRET)).toBeNull();
    expect(verifySignedToken("", SECRET)).toBeNull();
    expect(verifySignedToken("!!!not-base64url!!!", SECRET)).toBeNull();
  });

  it("rejects a well-formed but malformed-payload token (wrong segment count)", () => {
    const malformed = Buffer.from("only.two").toString("base64url");
    expect(verifySignedToken(malformed, SECRET)).toBeNull();
  });

  it("produces different tokens for different subjects", () => {
    const a = createSignedToken("invoice-1", 60_000, SECRET);
    const b = createSignedToken("invoice-2", 60_000, SECRET);
    expect(a).not.toBe(b);
  });
});
