import { describe, it, expect } from "vitest";
import { createImpersonationToken, verifyImpersonationToken } from "../impersonation";

const SECRET = "test-secret";

describe("impersonation token", () => {
  it("round-trips the session id", () => {
    const token = createImpersonationToken("session-123", SECRET);
    expect(verifyImpersonationToken(token, SECRET)).toBe("session-123");
  });

  it("rejects a tampered token", () => {
    const token = createImpersonationToken("session-123", SECRET);
    const tampered = token.slice(0, -2) + "xx";
    expect(verifyImpersonationToken(tampered, SECRET)).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = createImpersonationToken("session-123", SECRET);
    expect(verifyImpersonationToken(token, "wrong-secret")).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = createImpersonationToken("session-123", SECRET);
    const past = Date.now() + 31 * 60 * 1000; // past the 30-minute TTL
    expect(verifyImpersonationToken(token, SECRET, past)).toBeNull();
  });
});
