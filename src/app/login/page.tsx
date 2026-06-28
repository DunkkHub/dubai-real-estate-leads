import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { LoginForm } from "@/app/login/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session?.user) redirect("/dashboard");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-stone-100 px-4 py-10">
      <LoginForm />
    </main>
  );
}
