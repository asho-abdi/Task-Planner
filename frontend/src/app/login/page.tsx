"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { AuthShowcase } from "@/components/auth/auth-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin } from "@/features/auth/hooks";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-11 rounded-none border-0 border-b border-[#d5dbe3] bg-transparent px-0 shadow-none focus-visible:border-[#2b6def] focus-visible:ring-0";

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
  const [showPassword, setShowPassword] = useState(false);

  return (
    <AuthShowcase>
      <h1 className="text-[40px] font-bold leading-none tracking-tight text-[#111827]">
        Login
      </h1>
      <p className="mt-3 max-w-[260px] text-sm leading-6 text-[#9aa3b2]">
        Welcome back. Sign in to continue to your workspace.
      </p>
      <form
        className="mt-10 space-y-7"
        onSubmit={(event) => {
          event.preventDefault();
          login.mutate({ email, password });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="email" className="text-[13px] font-medium text-[#374151]">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className={fieldClass}
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="password"
            className="text-[13px] font-medium text-[#374151]"
          >
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Please enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className={cn(fieldClass, "pr-10")}
            />
            <button
              type="button"
              className="absolute right-0 top-1/2 -translate-y-1/2 text-[#9aa3b2] hover:text-[#4b5563]"
              onClick={() => setShowPassword((open) => !open)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
        {login.error ? (
          <p className="text-sm text-destructive">{login.error.message}</p>
        ) : null}
        <button
          type="submit"
          disabled={login.isPending}
          className="h-11 w-full rounded-md bg-[#2b6def] text-sm font-semibold uppercase tracking-[0.14em] text-white shadow-[0_10px_22px_rgba(43,109,239,0.35)] transition-colors hover:bg-[#2560d6] disabled:opacity-60"
        >
          {login.isPending ? "Signing in..." : "Login"}
        </button>
      </form>
      <p className="mt-8 text-sm text-[#9aa3b2]">
        No account?{" "}
        <Link className="font-medium text-[#2b6def] hover:underline" href={registerHref}>
          Create one
        </Link>
      </p>
    </AuthShowcase>
  );
}
