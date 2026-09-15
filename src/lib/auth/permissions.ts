/**
 * Server-side permission checks (US-A6). Mirrors docs/PERMISSIONS.md — keep
 * both in sync. RLS is the last line of defense; call these BEFORE any
 * mutation in a server action or route handler, don't rely on RLS alone.
 */

export type OrgRole = "owner" | "manager";

export type PermissionAction =
  | "org:view_settings"
  | "org:edit_settings"
  | "org:manage_mpesa_credentials"
  | "org:delete"
  | "org:transfer_ownership"
  | "org:manage_staff"
  | "property:write"
  | "lease:write"
  | "tenant:invite"
  | "payment:record_manual"
  | "invoice:void"
  | "report:view"
  | "maintenance:manage";

const OWNER_ONLY: ReadonlySet<PermissionAction> = new Set([
  "org:manage_mpesa_credentials",
  "org:delete",
  "org:transfer_ownership",
  "org:manage_staff",
]);

/** Actions available to both owner and manager. */
const OWNER_AND_MANAGER: ReadonlySet<PermissionAction> = new Set([
  "org:view_settings",
  "org:edit_settings",
  "property:write",
  "lease:write",
  "tenant:invite",
  "payment:record_manual",
  "invoice:void",
  "report:view",
  "maintenance:manage",
]);

export function can(role: OrgRole, action: PermissionAction): boolean {
  if (OWNER_ONLY.has(action)) return role === "owner";
  if (OWNER_AND_MANAGER.has(action)) return role === "owner" || role === "manager";
  return false;
}

export class PermissionDeniedError extends Error {
  constructor(action: PermissionAction, role: OrgRole) {
    super(`Role "${role}" is not permitted to perform "${action}"`);
    this.name = "PermissionDeniedError";
  }
}

/** Throws PermissionDeniedError if the role can't perform the action. */
export function assertCan(role: OrgRole, action: PermissionAction): void {
  if (!can(role, action)) {
    throw new PermissionDeniedError(action, role);
  }
}
