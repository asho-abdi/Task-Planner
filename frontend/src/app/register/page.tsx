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
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-full bg-white text-[#2D3766]">
      <div className="grid min-h-svh lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section className="flex flex-col px-8 py-8 sm:px-14 sm:py-10 lg:px-20 lg:py-12">
          <AuthBrandLink />

          <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center py-10">
            <h1 className="font-heading text-[32px] font-extrabold leading-[1.15] tracking-[-0.03em] text-[#374151] sm:text-[34px]">
              Registration Form
            </h1>

            <form
              className="mt-10 space-y-8"
              onSubmit={(event) => {
                event.preventDefault();
                const name = `${firstName} ${lastName}`.trim();
                register.mutate({ name, email, password });
              }}
            >
              <div className="grid gap-8 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[13px] text-[#9CA3AF]">
                    First Name
                  </span>
                  <input
                    autoComplete="given-name"
                    placeholder="Name"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    required
                    className={authLineField}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[13px] text-[#9CA3AF]">
                    Second Name
                  </span>
                  <input
                    autoComplete="family-name"
                    placeholder="Name"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    required
                    className={authLineField}
                  />
                </label>
              </div>

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
                    autoComplete="new-password"
                    minLength={8}
                    placeholder="At least 8 characters"
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

              {register.error ? (
                <p className="text-sm text-destructive">{register.error.message}</p>
              ) : null}

              <button
                type="submit"
                disabled={register.isPending}
                className="h-12 min-w-[168px] rounded-full bg-[#2D3766] px-10 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(45,55,102,0.28)] transition-colors hover:bg-[#243058] disabled:opacity-60"
              >
                {register.isPending ? "Registering…" : "Register"}
              </button>
            </form>

            <p className="mt-8 text-sm text-[#9CA3AF]">
              Already have an account?{" "}
              <Link
                className="font-medium text-[#2D3766] hover:underline"
                href={loginHref}
              >
                Sign in
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
