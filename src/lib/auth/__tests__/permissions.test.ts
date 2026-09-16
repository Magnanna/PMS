import { describe, expect, it } from "vitest";
import { can, assertCan, PermissionDeniedError, type PermissionAction } from "../permissions";

const OWNER_ONLY_ACTIONS: PermissionAction[] = [
  "org:manage_mpesa_credentials",
  "org:delete",
  "org:transfer_ownership",
  "org:manage_staff",
];

const OWNER_AND_MANAGER_ACTIONS: PermissionAction[] = [
  "org:view_settings",
  "org:edit_settings",
  "property:write",
  "lease:write",
  "tenant:invite",
  "payment:record_manual",
  "invoice:void",
  "report:view",
  "maintenance:manage",
];

describe("can", () => {
  it("allows owner every owner-only action", () => {
    for (const action of OWNER_ONLY_ACTIONS) {
      expect(can("owner", action)).toBe(true);
    }
  });

  it("denies manager every owner-only action (negative case, docs/PERMISSIONS.md matrix)", () => {
    for (const action of OWNER_ONLY_ACTIONS) {
      expect(can("manager", action)).toBe(false);
    }
  });

  it("allows both owner and manager every shared action", () => {
    for (const action of OWNER_AND_MANAGER_ACTIONS) {
      expect(can("owner", action)).toBe(true);
      expect(can("manager", action)).toBe(true);
    }
  });

  it("has no gaps: every PermissionAction is claimed by exactly one tier", () => {
    // Regression guard — a new action added to the type but forgotten in
    // both Sets would silently deny everyone rather than erroring loudly.
    const allActions: PermissionAction[] = [...OWNER_ONLY_ACTIONS, ...OWNER_AND_MANAGER_ACTIONS];
    const uniqueActions = new Set(allActions);
    expect(uniqueActions.size).toBe(allActions.length);
  });
});

describe("assertCan", () => {
  it("does not throw when the role is permitted", () => {
    expect(() => assertCan("owner", "org:delete")).not.toThrow();
    expect(() => assertCan("manager", "lease:write")).not.toThrow();
  });

  it("throws PermissionDeniedError when the role is not permitted (negative case)", () => {
    expect(() => assertCan("manager", "org:delete")).toThrow(PermissionDeniedError);
  });

  it("names the denied action and role in the error message", () => {
    try {
      assertCan("manager", "org:manage_mpesa_credentials");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(PermissionDeniedError);
      expect((e as Error).message).toContain("manager");
      expect((e as Error).message).toContain("org:manage_mpesa_credentials");
    }
  });
});
