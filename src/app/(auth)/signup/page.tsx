import { AuthForm } from "@/components/auth/AuthForm";

export default function SignupPage() {
  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <AuthForm initialMode="signup" />
    </main>
  );
}
