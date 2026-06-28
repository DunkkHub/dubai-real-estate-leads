"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
      callbackUrl: searchParams.get("callbackUrl") || "/dashboard",
    });
    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push(result?.url || "/dashboard");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-emerald-700 text-white">
          <KeyRound className="h-5 w-5" aria-hidden="true" />
        </div>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Use the seeded admin account or any user you add later.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Email">
            <Input name="email" type="email" autoComplete="email" defaultValue="admin@dubai-leads.local" required />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" autoComplete="current-password" defaultValue="Password123!" required />
          </Field>
          {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
          <Button className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <div className="mt-5 flex flex-wrap gap-3 text-sm text-stone-600">
          <Link className="underline hover:text-stone-950" href="/landing">Landing page</Link>
          <Link className="underline hover:text-stone-950" href="/calculator">ROI calculator</Link>
          <Link className="underline hover:text-stone-950" href="/privacy">Privacy</Link>
        </div>
      </CardContent>
    </Card>
  );
}
