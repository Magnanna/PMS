import { describe, expect, it } from "vitest";
import { isRateLimited } from "../rate-limit";

describe("isRateLimited", () => {
  it("allows requests up to the max within the window", () => {
    const key = `test-${Math.random()}`;
    expect(isRateLimited(key, 3, 10_000)).toBe(false);
    expect(isRateLimited(key, 3, 10_000)).toBe(false);
    expect(isRateLimited(key, 3, 10_000)).toBe(false);
  });

  it("blocks the request once the max is exceeded (negative case)", () => {
    const key = `test-${Math.random()}`;
    isRateLimited(key, 2, 10_000);
    isRateLimited(key, 2, 10_000);
    expect(isRateLimited(key, 2, 10_000)).toBe(true);
  });

  it("tracks keys independently", () => {
    const keyA = `test-a-${Math.random()}`;
    const keyB = `test-b-${Math.random()}`;
    isRateLimited(keyA, 1, 10_000);
    expect(isRateLimited(keyA, 1, 10_000)).toBe(true);
    expect(isRateLimited(keyB, 1, 10_000)).toBe(false);
  });

  it("allows requests again once the window has passed", () => {
    const key = `test-${Math.random()}`;
    expect(isRateLimited(key, 1, 5)).toBe(false);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(isRateLimited(key, 1, 5)).toBe(false);
        resolve();
      }, 20);
    });
  });
});
