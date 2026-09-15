import { AuthForm } from "@/components/auth/AuthForm";

export default function LoginPage() {
  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <AuthForm initialMode="login" />
    </main>
  );
}
