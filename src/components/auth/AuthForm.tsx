"use client";

import * as React from "react";
import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Lock,
  Building2,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertTriangle,
  KeyRound,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signIn, signUp, requestPasswordReset } from "@/app/(auth)/actions";

type AuthMode = "login" | "signup" | "reset";

interface PasswordStrength {
  score: number;
  feedback: string[];
}

function calculatePasswordStrength(password: string): PasswordStrength {
  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  };
  const score = Object.values(requirements).filter(Boolean).length;
  const feedback: string[] = [];
  if (!requirements.length) feedback.push("8+ characters");
  if (!requirements.uppercase) feedback.push("One uppercase letter");
  if (!requirements.number) feedback.push("One number");
  if (!requirements.special) feedback.push("One special character");
  return { score, feedback };
}

/** Uses --color-bad/--color-warn/--color-good only — the app's existing
 *  state-semantic palette (docs/DESIGN.md), no new hues introduced. */
function strengthColor(score: number): string {
  if (score <= 1) return "var(--color-bad)";
  if (score <= 3) return "var(--color-warn)";
  return "var(--color-good)";
}

function strengthLabel(score: number): string {
  if (score <= 1) return "Weak";
  if (score <= 3) return "Fair";
  if (score <= 4) return "Good";
  return "Strong";
}

function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const strength = calculatePasswordStrength(password);

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full bg-[var(--color-ink-100)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${(strength.score / 5) * 100}%`,
              backgroundColor: strengthColor(strength.score),
            }}
          />
        </div>
        <span
          className="text-xs tabular-nums"
          style={{ color: strengthColor(strength.score) }}
        >
          {strengthLabel(strength.score)}
        </span>
      </div>
      {strength.feedback.length > 0 && (
        <p className="text-xs text-[var(--color-ink-400)]">
          Needs: {strength.feedback.join(", ")}
        </p>
      )}
    </div>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-[var(--color-bad)] mt-1 flex items-center gap-1">
      <AlertTriangle className="h-3 w-3" />
      {children}
    </p>
  );
}

function TextField({
  icon: Icon,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  icon: React.ComponentType<{ className?: string }>;
  error?: string;
}) {
  return (
    <div>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-ink-400)]" />
        <input
          {...props}
          className={cn(
            "hairline w-full rounded-md pl-9 pr-3 py-2 text-sm bg-white placeholder:text-[var(--color-ink-400)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-100)] focus:border-[var(--color-accent-500)]",
            error && "border-[var(--color-bad)]"
          )}
        />
      </div>
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}

export function AuthForm({ initialMode }: { initialMode: "login" | "signup" }) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // Read once at mount time. Deliberately differs between the server render
  // (no localStorage) and the client's first render — suppressHydrationWarning
  // on the two elements below is the React-sanctioned escape hatch for that,
  // rather than syncing it in via a setState-in-effect anti-pattern.
  const [rememberedEmail] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem("pms_remembered_email") ?? ""
  );
  const [rememberMe, setRememberMe] = useState(() => rememberedEmail.length > 0);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const switchTab = useCallback(
    (next: "login" | "signup") => {
      setError(null);
      setMode(next);
      router.push(next === "login" ? "/login" : "/signup");
    },
    [router]
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    if (mode === "signup") {
      if (!agreeToTerms) {
        setError("You must agree to the Terms of Service and Privacy Policy");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      const strength = calculatePasswordStrength(password);
      if (strength.score < 3) {
        setError("Choose a stronger password");
        return;
      }
    }

    startTransition(async () => {
      if (mode === "login") {
        if (rememberMe) {
          try {
            localStorage.setItem("pms_remembered_email", String(formData.get("email") ?? ""));
          } catch {
            // localStorage unavailable (private mode) — non-critical convenience only.
          }
        }
        const result = await signIn({ error: null }, formData);
        if (result.error) setError(result.error);
      } else if (mode === "signup") {
        const result = await signUp({ error: null }, formData);
        if (result.error) setError(result.error);
      } else {
        await requestPasswordReset({ error: null }, formData);
        setResetSent(true);
      }
    });
  };

  if (mode === "reset") {
    return (
      <div className="card p-8 max-w-sm w-full space-y-4">
        {resetSent ? (
          <div className="text-center space-y-3 py-2">
            <CheckCircle2 className="h-10 w-10 mx-auto" style={{ color: "var(--color-good)" }} />
            <h1 className="text-lg font-semibold tracking-tight">Check your email</h1>
            <p className="text-sm text-[var(--color-ink-600)]">
              If an account exists for that address, we&apos;ve sent a password reset link.
            </p>
            <button
              type="button"
              onClick={() => {
                setResetSent(false);
                setMode("login");
              }}
              className="text-sm text-[var(--color-accent-500)]"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center space-y-1 mb-2">
              <KeyRound className="h-8 w-8 mx-auto text-[var(--color-accent-500)]" />
              <h1 className="text-lg font-semibold tracking-tight">Reset your password</h1>
              <p className="text-sm text-[var(--color-ink-600)]">
                Enter your email and we&apos;ll send you a reset link.
              </p>
            </div>

            {error && <FieldError>{error}</FieldError>}

            <TextField name="email" type="email" placeholder="Email address" icon={Mail} required />

            <button type="submit" disabled={pending} className="btn-primary w-full px-4 py-2">
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
              ) : (
                "Send reset link"
              )}
            </button>

            <button
              type="button"
              onClick={() => setMode("login")}
              className="text-sm text-[var(--color-accent-500)] w-full text-center"
            >
              Back to sign in
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="card p-8 max-w-sm w-full space-y-5">
      <div className="text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          {mode === "login" ? "Welcome back" : "Create your organization"}
        </h1>
        <p className="text-sm text-[var(--color-ink-600)] mt-1">
          {mode === "login" ? "Sign in to your account" : "Start managing your rentals"}
        </p>
      </div>

      <div className="flex bg-[var(--color-ink-50)] rounded-lg p-1">
        <button
          type="button"
          onClick={() => switchTab("login")}
          className={cn(
            "flex-1 py-1.5 rounded-md text-sm font-medium transition-colors",
            mode === "login"
              ? "bg-white text-[var(--color-ink-900)] shadow-sm"
              : "text-[var(--color-ink-600)]"
          )}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => switchTab("signup")}
          className={cn(
            "flex-1 py-1.5 rounded-md text-sm font-medium transition-colors",
            mode === "signup"
              ? "bg-white text-[var(--color-ink-900)] shadow-sm"
              : "text-[var(--color-ink-600)]"
          )}
        >
          Create account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <FieldError>{error}</FieldError>}

        {mode === "signup" && (
          <>
            <TextField
              name="orgName"
              placeholder="Organization name, e.g. Kamau Properties"
              icon={Building2}
              required
            />
            <TextField
              name="kraPin"
              placeholder="KRA PIN (optional for now)"
              icon={ShieldCheck}
            />
          </>
        )}

        <TextField
          name="email"
          type="email"
          placeholder="Email address"
          icon={Mail}
          required
          defaultValue={mode === "login" ? rememberedEmail : undefined}
          suppressHydrationWarning
        />

        <div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-ink-400)]" />
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="hairline w-full rounded-md pl-9 pr-10 py-2 text-sm bg-white placeholder:text-[var(--color-ink-400)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-100)] focus:border-[var(--color-accent-500)]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] hover:text-[var(--color-ink-600)]"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {mode === "signup" && <PasswordStrengthMeter password={password} />}
        </div>

        {mode === "signup" && (
          <div className="relative">
            <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-ink-400)]" />
            <input
              type={showConfirm ? "text" : "password"}
              placeholder="Confirm password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="hairline w-full rounded-md pl-9 pr-10 py-2 text-sm bg-white placeholder:text-[var(--color-ink-400)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-100)] focus:border-[var(--color-accent-500)]"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] hover:text-[var(--color-ink-600)]"
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        )}

        {mode === "login" ? (
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-[var(--color-ink-600)] cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                suppressHydrationWarning
                className="rounded border-[var(--color-ink-200)]"
              />
              Remember me
            </label>
            <button
              type="button"
              onClick={() => setMode("reset")}
              className="text-sm text-[var(--color-accent-500)]"
            >
              Forgot password?
            </button>
          </div>
        ) : (
          <label className="flex items-start gap-2 text-sm text-[var(--color-ink-600)] cursor-pointer">
            <input
              type="checkbox"
              checked={agreeToTerms}
              onChange={(e) => setAgreeToTerms(e.target.checked)}
              className="mt-0.5 rounded border-[var(--color-ink-200)]"
            />
            <span>
              I agree to the{" "}
              <a href="/terms" className="text-[var(--color-accent-500)]">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" className="text-[var(--color-accent-500)]">
                Privacy Policy
              </a>
            </span>
          </label>
        )}

        <button type="submit" disabled={pending} className="btn-primary w-full px-4 py-2">
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
          ) : mode === "login" ? (
            "Sign in"
          ) : (
            "Create organization"
          )}
        </button>
      </form>
    </div>
  );
}
