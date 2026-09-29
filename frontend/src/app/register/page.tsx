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
import { useRegister } from "@/features/auth/hooks";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const register = useRegister();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const loginHref = next
    ? `/login?next=${encodeURIComponent(next)}`
    : "/login";
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const passwordLongEnough = password.length >= 8;

  return (
    <AuthLayout
      eyebrow="Get started"
      panelTitle="Give your team a calmer way to work."
      panelDescription="Create an account, start a workspace and invite people by role in under a minute."
    >
      <AuthHeading
        title="Create your account"
        description="Set up takes less than a minute."
      />

      <form
        className="mt-8 space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          const name = `${firstName} ${lastName}`.trim();
          register.mutate({ name, email, password });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="register-first">First name</Label>
            <Input
              id="register-first"
              autoComplete="given-name"
              placeholder="Amina"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              required
              autoFocus
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="register-last">Last name</Label>
            <Input
              id="register-last"
              autoComplete="family-name"
              placeholder="Hassan"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              required
              className="h-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="register-email">Work email</Label>
          <Input
            id="register-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="h-10"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="register-password">Password</Label>
          <PasswordInput
            id="register-password"
            autoComplete="new-password"
            minLength={8}
            placeholder="At least 8 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            aria-describedby="register-password-hint"
          />
          <p
            id="register-password-hint"
            className={cn(
              "text-xs transition-colors",
              password && passwordLongEnough
                ? "text-success-soft-foreground"
                : "text-muted-foreground",
            )}
          >
            {password && passwordLongEnough ? "Looks good." : "Use 8 or more characters."}
          </p>
        </div>

        {register.error ? (
          <ErrorState title="Couldn't create your account" description={register.error.message} />
        ) : null}

        <Button type="submit" size="lg" className="w-full" loading={register.isPending}>
          Create account
          <ArrowRight />
        </Button>
      </form>

      <p className="mt-8 text-center text-base text-muted-foreground">
        Already have an account?{" "}
        <Link
          className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href={loginHref}
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
