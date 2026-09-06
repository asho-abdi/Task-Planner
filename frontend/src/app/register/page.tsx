"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthCard, AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRegister } from "@/features/auth/hooks";

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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <AuthLayout
      eyebrow="Get started"
      panelTitle="A quieter way to run the week."
      panelDescription="Create an account, then start a workspace or join one you were invited to."
    >
      <AuthCard>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground lg:hidden">
          Task Planner and Tracker
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight lg:mt-0">
          Create an account
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          After you sign up, create a workspace or accept an invitation.
        </p>
        <form
          className="mt-7 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            register.mutate({ name, email, password });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {register.error ? (
            <p className="text-sm text-destructive">{register.error.message}</p>
          ) : null}
          <Button className="w-full" type="submit" disabled={register.isPending}>
            {register.isPending ? "Creating..." : "Create account"}
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link className="font-medium text-primary hover:underline" href={loginHref}>
            Sign in
          </Link>
        </p>
      </AuthCard>
    </AuthLayout>
  );
}
