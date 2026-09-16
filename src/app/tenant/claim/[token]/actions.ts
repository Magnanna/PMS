"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenantProfiles } from "@/db/schema";
import { verifyTenantInviteToken } from "@/lib/auth/tenant-invite";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type ClaimState = { error: string | null };

/** Tenants without an email get a synthetic, never-emailed identity so
 *  Supabase's email/password auth still works — SMS is the real delivery
 *  channel for this whole flow (US-A4). */
function authEmailFor(tenant: { email: string | null; phone: string }): string {
  return tenant.email ?? `${tenant.phone}@tenant.pms.local`;
}

export async function claimTenantAccount(
  token: string,
  _prev: ClaimState,
  formData: FormData
): Promise<ClaimState> {
  const verified = verifyTenantInviteToken(token);
  if (!verified) return { error: "This invite link has expired or is invalid." };

  const parsed = schema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const [tenant] = await db
    .select()
    .from(tenantProfiles)
    .where(eq(tenantProfiles.id, verified.tenantProfileId));
  if (!tenant) return { error: "Tenant record not found." };
  if (tenant.userId) return { error: "This invite has already been used — try signing in." };

  const authEmail = authEmailFor(tenant);
  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: authEmail,
    password: parsed.data.password,
    email_confirm: true,
  });

  let userId: string;

  if (createError) {
    // Already registered — likely the same person claiming a second org's
    // lease (US-A5 cross-org identity). Sign in with the password they just
    // entered; if that's not their existing password, tell them to sign in
    // normally instead of guessing/resetting anything on their behalf.
    if (!/already registered|already exists/i.test(createError.message)) {
      return { error: createError.message };
    }

    const supabase = await createClient();
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: parsed.data.password,
    });
    if (signInError || !signInData.user) {
      return {
        error:
          "An account already exists for this contact. Sign in with your existing password instead.",
      };
    }
    userId = signInData.user.id;
  } else {
    userId = created.user.id;
  }

  await db.update(tenantProfiles).set({ userId }).where(eq(tenantProfiles.id, tenant.id));

  // New account: sign in now to establish the session (admin.createUser
  // doesn't create one).
  if (!createError) {
    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: parsed.data.password,
    });
    if (signInError) return { error: signInError.message };
  }

  redirect("/portal");
}
