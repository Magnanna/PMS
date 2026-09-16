import { describe, expect, it } from "vitest";
import { normalizeKenyanPhone, toE164 } from "../phone";

describe("normalizeKenyanPhone", () => {
  it("normalizes a 0-prefixed Safaricom number", () => {
    expect(normalizeKenyanPhone("0712345678")).toBe("254712345678");
  });

  it("normalizes a 0-prefixed Airtel-range (1xx) number", () => {
    expect(normalizeKenyanPhone("0112345678")).toBe("254112345678");
  });

  it("normalizes an already-254-prefixed number", () => {
    expect(normalizeKenyanPhone("254712345678")).toBe("254712345678");
  });

  it("normalizes a +254-prefixed number", () => {
    expect(normalizeKenyanPhone("+254712345678")).toBe("254712345678");
  });

  it("normalizes a bare-7-prefixed number (no leading 0)", () => {
    expect(normalizeKenyanPhone("712345678")).toBe("254712345678");
  });

  it("strips spaces and punctuation", () => {
    expect(normalizeKenyanPhone("0712 345 678")).toBe("254712345678");
    expect(normalizeKenyanPhone("+254-712-345-678")).toBe("254712345678");
  });

  it("throws on an invalid/too-short number (negative case)", () => {
    expect(() => normalizeKenyanPhone("12345")).toThrow();
  });

  it("throws on a non-Kenyan number (negative case)", () => {
    expect(() => normalizeKenyanPhone("+14155552671")).toThrow();
  });

  it("throws on an empty string (negative case)", () => {
    expect(() => normalizeKenyanPhone("")).toThrow();
  });

  it("throws on a landline-shaped (02xx) number (negative case)", () => {
    expect(() => normalizeKenyanPhone("0203456789")).toThrow();
  });
});

describe("toE164", () => {
  it("adds a + prefix to the normalized number", () => {
    expect(toE164("0712345678")).toBe("+254712345678");
  });
});
