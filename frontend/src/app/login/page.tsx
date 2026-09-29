"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import {
  AuthBrandLink,
  AuthRocketPanel,
  authLineField,
} from "@/components/auth/auth-layout";
import { useLogin } from "@/features/auth/hooks";
import { cn } from "@/lib/utils";

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
    <div className="min-h-full bg-white text-[#2D3766]">
      <div className="grid min-h-svh lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section className="flex flex-col px-8 py-8 sm:px-14 sm:py-10 lg:px-20 lg:py-12">
          <AuthBrandLink />

          <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center py-10">
            <h1 className="font-heading text-[32px] font-extrabold leading-[1.15] tracking-[-0.03em] text-[#374151] sm:text-[34px]">
              Sign In
            </h1>
            <p className="mt-2 text-[15px] font-normal leading-[1.5] text-[#9CA3AF]">
              Welcome back. Continue to your workspace.
            </p>

            <form
              className="mt-10 space-y-8"
              onSubmit={(event) => {
                event.preventDefault();
                login.mutate({ email, password });
              }}
            >
              <label className="block">
                <span className="mb-2 block text-[13px] text-[#9CA3AF]">
                  Email
                </span>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className={authLineField}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[13px] text-[#9CA3AF]">
                  Password
                </span>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    className={cn(authLineField, "pr-9")}
                  />
                  <button
                    type="button"
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151]"
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
              </label>

              {login.error ? (
                <p className="text-sm text-destructive">{login.error.message}</p>
              ) : null}

              <button
                type="submit"
                disabled={login.isPending}
                className="h-12 min-w-[168px] rounded-full bg-[#2D3766] px-10 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(45,55,102,0.28)] transition-colors hover:bg-[#243058] disabled:opacity-60"
              >
                {login.isPending ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <p className="mt-8 text-sm text-[#9CA3AF]">
              No account?{" "}
              <Link
                className="font-medium text-[#2D3766] hover:underline"
                href={registerHref}
              >
                Register
              </Link>
            </p>
          </div>
        </section>

        <aside className="relative hidden overflow-hidden bg-[#2D3766] lg:block">
          <AuthRocketPanel />
        </aside>
      </div>
    </div>
  );
}
