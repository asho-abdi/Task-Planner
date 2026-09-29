"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { AuthHeading, AuthLayout } from "@/components/auth/auth-layout";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin } from "@/features/auth/hooks";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const login = useLogin();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const registerHref = next
    ? `/register?next=${encodeURIComponent(next)}`
    : "/register";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <AuthLayout
      eyebrow="Welcome back"
      panelTitle="See the day. Finish the work."
      panelDescription="Tasks, meetings and project progress side by side — in the workspace you left."
    >
      <AuthHeading
        title="Sign in"
        description="Welcome back. Continue to your workspace."
      />

      <form
        className="mt-8 space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          login.mutate({ email, password });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoFocus
            className="h-10"
            aria-invalid={login.error ? true : undefined}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="login-password">Password</Label>
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            aria-invalid={login.error ? true : undefined}
          />
        </div>

        {login.error ? (
          <ErrorState title="Couldn't sign you in" description={login.error.message} />
        ) : null}

        <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
          Sign in
          <ArrowRight />
        </Button>
      </form>

      <p className="mt-8 text-center text-base text-muted-foreground">
        No account?{" "}
        <Link
          className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          href={registerHref}
        >
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}
