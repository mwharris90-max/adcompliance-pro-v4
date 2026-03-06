"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Eye, EyeOff, Loader2, ShieldCheck, Globe, ClipboardCheck } from "lucide-react";

import { loginSchema, type LoginInput } from "@/lib/validators/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

// Inner component that uses useSearchParams (must be inside Suspense)
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/app/dashboard";
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = (data: LoginInput) => {
    setError(null);
    startTransition(async () => {
      const result = await signIn("credentials", {
        username: data.username,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid username or password. Please try again.");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Sign in</h2>
        <p className="text-sm text-slate-500 mt-1">
          Enter your credentials to access your account
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="username">Username or Email</Label>
        <Input
          id="username"
          placeholder="Enter your username or email"
          autoComplete="username"
          autoFocus
          {...register("username")}
        />
        {errors.username && (
          <p className="text-sm text-red-500">{errors.username.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            autoComplete="current-password"
            className="pr-10"
            {...register("password")}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-sm text-red-500">{errors.password.message}</p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full bg-gradient-to-r from-[#1A56DB] to-[#E4168A] text-white hover:opacity-90 border-0"
        disabled={isPending}
      >
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Sign In
      </Button>

      <div className="text-center">
        <Link
          href="/forgot-password"
          className="text-sm text-slate-500 hover:text-[#1A56DB] transition-colors"
        >
          Forgot your password?
        </Link>
      </div>

      <div className="text-center pt-2 border-t border-slate-100">
        <p className="text-xs text-slate-400">
          Powered by{" "}
          <a
            href="https://theaux.co.uk"
            className="text-[#1A56DB] hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            AUX
          </a>
        </p>
      </div>
    </form>
  );
}

function LoginSkeleton() {
  return (
    <div className="space-y-5">
      <div>
        <Skeleton className="h-7 w-24 mb-2" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left panel — dark navy */}
      <div className="hidden lg:flex lg:flex-col lg:w-1/2 bg-[#0E1726] p-12 relative overflow-hidden">
        {/* Subtle gradient glow top-right */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-15 blur-3xl bg-gradient-to-bl from-[#E4168A] to-[#1A56DB] pointer-events-none" />

        <div className="relative flex flex-col h-full">
          {/* AUX logomark */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="AUX"
            className="h-10 w-auto mb-12 brightness-0 invert"
          />

          {/* Main content */}
          <div className="flex-1">
            <h1 className="text-3xl font-semibold text-white mb-3 leading-snug">
              Ad Compliance Pro
            </h1>
            <p className="text-slate-400 text-base mb-10 max-w-xs leading-relaxed">
              Bold, compliant, and effective advertising — at every stage.
            </p>

            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-slate-300 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1A56DB]/20">
                  <ClipboardCheck className="h-3.5 w-3.5 text-[#1A56DB]" />
                </span>
                Platform policy checks
              </li>
              <li className="flex items-center gap-3 text-slate-300 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1A56DB]/20">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#1A56DB]" />
                </span>
                AI-powered compliance analysis
              </li>
              <li className="flex items-center gap-3 text-slate-300 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1A56DB]/20">
                  <Globe className="h-3.5 w-3.5 text-[#1A56DB]" />
                </span>
                20+ jurisdictions supported
              </li>
            </ul>
          </div>

          {/* Footer */}
          <div className="mt-auto">
            <a
              href="https://theaux.co.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
            >
              Powered by AUX · theaux.co.uk
            </a>
          </div>
        </div>
      </div>

      {/* Right panel — white form */}
      <div className="flex-1 flex items-center justify-center bg-white p-8">
        <div className="w-full max-w-sm">
          {/* Mobile branding (hidden on lg+) */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="AUX"
              className="h-10 w-auto mb-3"
            />
            <h1 className="text-lg font-semibold text-slate-900">
              Ad Compliance Pro
            </h1>
            <p className="text-xs text-[#1A56DB]">by AUX</p>
          </div>

          <Suspense fallback={<LoginSkeleton />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
