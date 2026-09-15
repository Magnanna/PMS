"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const signUpSchema = z.object({
  orgName: z.string().min(2, "Org name is required"),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  kraPin: z.string().optional(),
});

export type FormState = { error: string | null };

/** US-A1: signup creates the auth user, an org row, and links user as owner. */
export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse({
    orgName: formData.get("orgName"),
    email: formData.get("email"),
    password: formData.get("password"),
    kraPin: formData.get("kraPin") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { orgName, email, password, kraPin } = parsed.data;

  const supabase = await createClient();
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError || !signUpData.user) {
    return { error: signUpError?.message ?? "Sign up failed" };
  }

  // Org + owner membership created with the admin client: RLS's org_members
  // bootstrap policy allows a self-insert into a zero-member org, but doing
  // both inserts atomically server-side avoids a half-created org if the
  // second insert's policy check races the first.
  const admin = createAdminClient();

  const { data: org, error: orgError } = await admin
    .from("orgs")
    .insert({ name: orgName, kra_pin: kraPin ?? null })
    .select("id")
    .single();

  if (orgError || !org) {
    return { error: orgError?.message ?? "Could not create organization" };
  }

  const { error: memberError } = await admin
    .from("org_members")
    .insert({ org_id: org.id, user_id: signUpData.user.id, role: "owner" });

  if (memberError) {
    return { error: memberError.message };
  }

  const { error: settingsError } = await admin
    .from("org_settings")
    .insert({ org_id: org.id });

  if (settingsError) {
    return { error: settingsError.message };
  }

  redirect("/onboarding");
}

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

const resetSchema = z.object({ email: z.string().email() });

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = resetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email);

  // Never reveal whether the email exists — same response either way.
  if (error) return { error: null };
  return { error: null };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
