"use client";

import { useEffect, useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const schema = z.object({
  name: z.string().min(1, "Full name is required").max(100),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, "Username may only contain letters, numbers, underscores and hyphens"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
type FormValues = z.infer<typeof schema>;

type InviteState =
  | { status: "loading" }
  | { status: "valid"; email: string; organisationName: string | null }
  | { status: "invalid"; message: string }
  | { status: "success" };

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [invite, setInvite] = useState<InviteState>({ status: "loading" });
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    fetch(`/api/auth/invite/${token}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setInvite({ status: "valid", email: json.data.email, organisationName: json.data.organisationName });
        } else {
          setInvite({ status: "invalid", message: json.error?.message ?? "Invalid invite link" });
        }
      })
      .catch(() => setInvite({ status: "invalid", message: "Could not validate invite link" }));
  }, [token]);

  const onSubmit = (data: FormValues) => {
    setServerError(null);
    startTransition(async () => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...data }),
      });
      const json = await res.json();
      if (json.success) {
        setInvite({ status: "success" });
        setTimeout(() => router.push("/login"), 2500);
      } else {
        setServerError(json.error?.message ?? "Something went wrong. Please try again.");
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="AUX" className="h-10 w-auto mx-auto mb-3" />
          <h1 className="text-xl font-semibold text-slate-900">Ad Compliance Pro</h1>
          <p className="text-sm text-slate-500">by AUX</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          {/* Loading */}
          {invite.status === "loading" && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          )}

          {/* Invalid */}
          {invite.status === "invalid" && (
            <div className="text-center py-4">
              <ShieldCheck className="h-10 w-10 text-red-400 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Invite link invalid</h2>
              <p className="text-sm text-slate-500">{invite.message}</p>
              <p className="text-sm text-slate-400 mt-3">Please contact your administrator for a new invite.</p>
            </div>
          )}

          {/* Success */}
          {invite.status === "success" && (
            <div className="text-center py-4">
              <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Account created!</h2>
              <p className="text-sm text-slate-500">Redirecting you to the login page…</p>
            </div>
          )}

          {/* Registration form */}
          {invite.status === "valid" && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Create your account</h2>
                {invite.organisationName && (
                  <p className="text-sm text-slate-500 mt-1">
                    You have been invited to join <strong>{invite.organisationName}</strong>.
                  </p>
                )}
              </div>

              {serverError && (
                <Alert variant="destructive">
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}

              {/* Email — read-only, from invite */}
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={invite.email} disabled className="bg-slate-50 text-slate-500" />
                <p className="text-xs text-slate-400">Your email is set by your invite and cannot be changed.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" placeholder="Jane Smith" {...register("name")} />
                {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input id="username" placeholder="janesmith" autoComplete="username" {...register("username")} />
                {errors.username && <p className="text-sm text-red-500">{errors.username.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    className="pr-10"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-[#1A56DB] to-[#E4168A] text-white hover:opacity-90 border-0"
                disabled={isPending}
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create account
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
