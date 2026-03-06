"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Loader2,
  Eye,
  EyeOff,
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
  Trash2,
} from "lucide-react";

import {
  updateProfileSchema,
  changePasswordSchema,
  type UpdateProfileInput,
  type ChangePasswordInput,
} from "@/lib/validators/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  const { data: session, update } = useSession();

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>
        <p className="text-slate-500 mt-1">
          Manage your profile and account security.
        </p>
      </div>
      <Separator />
      <ProfileForm
        name={session?.user.name ?? ""}
        email={session?.user.email ?? ""}
        onUpdate={update}
      />
      <Separator />
      <PasswordForm />
      <Separator />
      <CertificationsSection />
    </div>
  );
}

// ── Profile form ──────────────────────────────────────────────────────────────

function ProfileForm({
  name,
  email,
  onUpdate,
}: {
  name: string;
  email: string;
  onUpdate: () => Promise<unknown>;
}) {
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name, email },
  });

  const onSubmit = (data: UpdateProfileInput) => {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-profile", ...data }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccess(true);
        await onUpdate();
      } else {
        setError(json.error?.message ?? "Something went wrong");
      }
    });
  };

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-base">Profile</CardTitle>
        <CardDescription>Update your name and email address</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {success && (
            <Alert className="border-green-200 bg-green-50">
              <AlertDescription className="text-green-800">
                Profile updated successfully.
              </AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" {...register("name")} />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isPending || !isDirty}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

// ── Certifications section ────────────────────────────────────────────────────

interface CertificationData {
  id: string;
  slug: string;
  name: string;
  platform: { name: string; slug: string };
  description: string;
  infoUrl: string | null;
  categoryIds: string[];
}

interface HeldCertData {
  id: string;
  certificationId: string;
  name: string;
  slug: string;
  platform: { name: string; slug: string };
  description: string;
  infoUrl: string | null;
  declaredAt: string;
  notes: string | null;
}

function CertificationsSection() {
  const [allCerts, setAllCerts] = useState<CertificationData[]>([]);
  const [heldCerts, setHeldCerts] = useState<HeldCertData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [allRes, heldRes] = await Promise.all([
        fetch("/api/certifications").then((r) => r.json()),
        fetch("/api/user/certifications").then((r) => r.json()),
      ]);
      if (allRes.success) setAllCerts(allRes.data);
      if (heldRes.success) setHeldCerts(heldRes.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const heldIds = new Set(heldCerts.map((h) => h.certificationId));
  const unheldCerts = allCerts.filter((c) => !heldIds.has(c.id));

  async function handleDeclare(certId: string) {
    setSaving(certId);
    try {
      const res = await fetch("/api/user/certifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certificationId: certId }),
      });
      if (res.ok) await fetchData();
    } catch {
      // ignore
    } finally {
      setSaving(null);
    }
  }

  async function handleRevoke(certId: string) {
    setSaving(certId);
    try {
      const res = await fetch("/api/user/certifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certificationId: certId }),
      });
      if (res.ok) await fetchData();
    } catch {
      // ignore
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Platform Certifications
        </CardTitle>
        <CardDescription>
          Declare which platform advertising certifications your organisation holds.
          This affects how compliance checks evaluate restricted categories — confirmed
          certifications suppress certification-requirement auto-failures.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading certifications...
          </div>
        ) : (
          <>
            {/* Held certifications */}
            {heldCerts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Your certifications
                </p>
                {heldCerts.map((cert) => (
                  <div
                    key={cert.id}
                    className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/50 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">{cert.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {cert.platform.name}
                          </Badge>
                          <span className="text-xs text-slate-400">
                            Declared {new Date(cert.declaredAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {cert.infoUrl && (
                        <a
                          href={cert.infoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-[#1A56DB]"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRevoke(cert.certificationId)}
                        disabled={saving === cert.certificationId}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        {saving === cert.certificationId ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Available certifications to add */}
            {unheldCerts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Available certifications
                </p>
                {unheldCerts.map((cert) => (
                  <div
                    key={cert.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <ShieldAlert className="h-5 w-5 text-slate-400 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">{cert.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {cert.platform.name}
                          </Badge>
                          <span className="text-xs text-slate-500 line-clamp-1">
                            {cert.description}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {cert.infoUrl && (
                        <a
                          href={cert.infoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-[#1A56DB]"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      <Button
                        size="sm"
                        onClick={() => handleDeclare(cert.id)}
                        disabled={saving === cert.id}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {saving === cert.id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Declare
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {allCerts.length === 0 && (
              <p className="text-sm text-slate-400 py-2">
                No platform certifications are configured yet.
              </p>
            )}

            <p className="text-xs text-slate-400 pt-2">
              By declaring a certification, you confirm that your organisation holds the stated
              platform certification. This is a self-declaration — it is your responsibility to
              ensure accuracy. Incorrectly declaring a certification may result in inaccurate
              compliance results.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Password form ─────────────────────────────────────────────────────────────

function PasswordForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  });

  const onSubmit = (data: ChangePasswordInput) => {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change-password", ...data }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccess(true);
        reset();
      } else {
        setError(json.error?.message ?? "Something went wrong");
      }
    });
  };

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-base">Change Password</CardTitle>
        <CardDescription>
          Update your password. You&apos;ll need your current password.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {success && (
            <Alert className="border-green-200 bg-green-50">
              <AlertDescription className="text-green-800">
                Password updated successfully.
              </AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Current password</Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showPassword ? "text" : "password"}
                className="pr-10"
                autoComplete="current-password"
                {...register("currentPassword")}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide" : "Show"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.currentPassword && (
              <p className="text-sm text-red-500">
                {errors.currentPassword.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Min. 8 chars, 1 uppercase, 1 number"
                autoComplete="new-password"
                {...register("newPassword")}
              />
              {errors.newPassword && (
                <p className="text-sm text-red-500">
                  {errors.newPassword.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-red-500">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Password
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
