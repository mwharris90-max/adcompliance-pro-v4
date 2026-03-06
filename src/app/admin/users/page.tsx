"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import {
  Plus,
  Pencil,
  KeyRound,
  Loader2,
  Copy,
  Check,
  ShieldCheck,
  User,
  Search,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AppUser {
  id: string;
  name: string;
  email: string;
  username: string;
  role: "USER" | "ADMIN";
  active: boolean;
  forcePasswordReset: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

// ── Zod schemas ────────────────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  username: z
    .string()
    .min(3, "Min 3 characters")
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, "Letters, numbers, _ and - only"),
  password: z.string().min(8, "Min 8 characters"),
  role: z.enum(["USER", "ADMIN"]),
  autoPassword: z.boolean(),
});
type CreateData = z.infer<typeof createSchema>;

const editSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  role: z.enum(["USER", "ADMIN"]),
});
type EditData = z.infer<typeof editSchema>;

// ── Password generator (mirrors server-side logic) ─────────────────────────────

function generatePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%&*";
  const all = upper + lower + digits + special;
  let pw = "";
  pw += upper[Math.floor(Math.random() * upper.length)];
  pw += digits[Math.floor(Math.random() * digits.length)];
  pw += lower[Math.floor(Math.random() * lower.length)];
  pw += special[Math.floor(Math.random() * special.length)];
  for (let i = 4; i < 12; i++) pw += all[Math.floor(Math.random() * all.length)];
  return pw.split("").sort(() => Math.random() - 0.5).join("");
}

function toUsernameSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_|_$/g, "");
}

// ── CopyButton ─────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={copy} className="gap-1.5">
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AppUser | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<AppUser | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null); // from reset
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchUsers = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((json) => { if (json.success) setUsers(json.data); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filtered = users.filter(
    (u) =>
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase())
  );

  // ── Create form ────────────────────────────────────────────────────────────

  const {
    register: regCreate,
    handleSubmit: handleCreate,
    reset: resetCreate,
    watch: watchCreate,
    setValue: setCreateValue,
    formState: { errors: createErrors },
  } = useForm<CreateData>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: "USER", autoPassword: true },
  });

  const autoPassword = watchCreate("autoPassword");
  const nameValue = watchCreate("name");

  useEffect(() => {
    if (nameValue) setCreateValue("username", toUsernameSlug(nameValue));
  }, [nameValue, setCreateValue]);

  useEffect(() => {
    if (autoPassword) setCreateValue("password", generatePassword());
  }, [autoPassword, setCreateValue]);

  function openCreate() {
    const pw = generatePassword();
    resetCreate({ name: "", email: "", username: "", password: pw, role: "USER", autoPassword: true });
    setGeneratedPassword(null);
    setError(null);
    setCreateOpen(true);
  }

  const onCreateSubmit = (data: CreateData) => {
    setError(null);
    const plainPassword = data.autoPassword ? data.password : data.password;
    startTransition(async () => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          username: data.username,
          password: plainPassword,
          role: data.role,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setCreateOpen(false);
        if (data.autoPassword) setGeneratedPassword(plainPassword);
        fetchUsers();
      } else {
        setError(json.error?.message ?? "Something went wrong");
      }
    });
  };

  // ── Edit form ──────────────────────────────────────────────────────────────

  const {
    register: regEdit,
    handleSubmit: handleEdit,
    reset: resetEdit,
    watch: watchEdit,
    setValue: setEditValue,
    formState: { errors: editErrors },
  } = useForm<EditData>({ resolver: zodResolver(editSchema) });

  function openEdit(user: AppUser) {
    setEditTarget(user);
    resetEdit({ name: user.name, email: user.email, role: user.role });
    setError(null);
  }

  const onEditSubmit = (data: EditData) => {
    if (!editTarget) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        setEditTarget(null);
        fetchUsers();
      } else {
        setError(json.error?.message ?? "Something went wrong");
      }
    });
  };

  // ── Active toggle ──────────────────────────────────────────────────────────

  function requestToggleActive(user: AppUser) {
    if (!user.active) {
      // Reactivating — no confirm needed
      patchUser(user.id, { active: true });
    } else {
      setDeactivateTarget(user);
    }
  }

  function confirmDeactivate() {
    if (!deactivateTarget) return;
    patchUser(deactivateTarget.id, { active: false });
    setDeactivateTarget(null);
  }

  function patchUser(id: string, data: Partial<AppUser>) {
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, ...data } : u));
    fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()).then((json) => {
      if (!json.success) {
        setError(json.error?.message ?? "Update failed");
        fetchUsers();
      }
    });
  }

  // ── Reset password ─────────────────────────────────────────────────────────

  function resetUserPassword(user: AppUser) {
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${user.id}/reset-password`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setTempPassword(json.data.temporaryPassword);
        fetchUsers();
      } else {
        setError(json.error?.message ?? "Reset failed");
      }
    });
  }

  const isSelf = (user: AppUser) => user.id === session?.user?.id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="text-slate-500 mt-1">Manage team access to AdCompliance Pro.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Add User
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search users..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Users table */}
      <div className="rounded-md border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-center">Active</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline-block text-slate-400" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-400">No users found.</TableCell>
              </TableRow>
            ) : (
              filtered.map((user) => (
                <TableRow key={user.id} className={!user.active ? "opacity-50" : undefined}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{user.name}</p>
                      {user.forcePasswordReset && (
                        <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5">
                          Must reset pw
                        </span>
                      )}
                      {isSelf(user) && (
                        <span className="text-xs text-slate-400">(you)</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">{user.username}</TableCell>
                  <TableCell className="text-sm text-slate-600">{user.email}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                        user.role === "ADMIN"
                          ? "bg-purple-50 text-purple-700 border-purple-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {user.role === "ADMIN" ? <ShieldCheck className="h-3 w-3" /> : <User className="h-3 w-3" />}
                      {user.role}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {user.lastLoginAt
                      ? format(new Date(user.lastLoginAt), "dd MMM yyyy, HH:mm")
                      : <span className="text-slate-300">Never</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={user.active}
                      onCheckedChange={() => requestToggleActive(user)}
                      disabled={isSelf(user)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => openEdit(user)}
                        title="Edit user"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-amber-500 hover:text-amber-600"
                        onClick={() => resetUserPassword(user)}
                        disabled={isPending}
                        title="Reset password"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Create User Dialog ─────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate(onCreateSubmit)} className="space-y-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Full name</Label>
                <Input {...regCreate("name")} placeholder="Jane Smith" />
                {createErrors.name && <p className="text-xs text-red-500">{createErrors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input {...regCreate("email")} type="email" placeholder="jane@agency.com" />
                {createErrors.email && <p className="text-xs text-red-500">{createErrors.email.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input {...regCreate("username")} className="font-mono text-sm" />
                {createErrors.username && <p className="text-xs text-red-500">{createErrors.username.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={watchCreate("role")} onValueChange={(v) => setCreateValue("role", v as "USER" | "ADMIN")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">User</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 col-span-2">
                <div className="flex items-center justify-between">
                  <Label>Password</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Auto-generate</span>
                    <Switch
                      checked={autoPassword}
                      onCheckedChange={(v) => {
                        setCreateValue("autoPassword", v);
                        if (v) setCreateValue("password", generatePassword());
                      }}
                    />
                  </div>
                </div>
                {autoPassword ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={watchCreate("password")}
                      readOnly
                      className="font-mono text-sm bg-slate-50"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCreateValue("password", generatePassword())}
                      className="whitespace-nowrap"
                    >
                      Regenerate
                    </Button>
                  </div>
                ) : (
                  <Input
                    {...regCreate("password")}
                    type="password"
                    placeholder="Min. 8 chars, 1 uppercase, 1 number"
                  />
                )}
                {createErrors.password && <p className="text-xs text-red-500">{createErrors.password.message}</p>}
                <p className="text-xs text-slate-400">User will be required to change their password on first login.</p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit User Dialog ───────────────────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        {editTarget && (
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Edit {editTarget.name}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEdit(onEditSubmit)} className="space-y-4">
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

              <div className="space-y-1.5">
                <Label>Full name</Label>
                <Input {...regEdit("name")} />
                {editErrors.name && <p className="text-xs text-red-500">{editErrors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input {...regEdit("email")} type="email" />
                {editErrors.email && <p className="text-xs text-red-500">{editErrors.email.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input value={editTarget.username} disabled className="font-mono text-sm bg-slate-50" />
                <p className="text-xs text-slate-400">Username cannot be changed after creation.</p>
              </div>

              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select
                  value={watchEdit("role")}
                  onValueChange={(v) => setEditValue("role", v as "USER" | "ADMIN")}
                  disabled={isSelf(editTarget)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">User</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
                {isSelf(editTarget) && <p className="text-xs text-slate-400">You cannot change your own role.</p>}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>

      {/* ── Deactivate confirm ─────────────────────────────────────────────── */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={(o) => !o && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {deactivateTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will prevent {deactivateTarget?.name} from logging in. Existing sessions will expire at their next token refresh. You can reactivate them at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeactivate} className="bg-red-600 hover:bg-red-700">
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Generated password reveal (after create) ──────────────────────── */}
      <Dialog open={!!generatedPassword} onOpenChange={(o) => !o && setGeneratedPassword(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>User created</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Share this temporary password with the new user. It will only be shown once — they will be prompted to change it on first login.
            </p>
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-md border border-slate-200">
              <code className="flex-1 font-mono text-sm font-medium text-slate-900">{generatedPassword}</code>
              {generatedPassword && <CopyButton text={generatedPassword} />}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setGeneratedPassword(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reset password reveal ──────────────────────────────────────────── */}
      <Dialog open={!!tempPassword} onOpenChange={(o) => !o && setTempPassword(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Password reset</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              This is the new temporary password. Share it with the user — they will be required to change it on their next login.
            </p>
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-md border border-slate-200">
              <code className="flex-1 font-mono text-sm font-medium text-slate-900">{tempPassword}</code>
              {tempPassword && <CopyButton text={tempPassword} />}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setTempPassword(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
