"use client";

import { useEffect, useState } from "react";
import { Copy, Plus, Trash2, Mail, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Invite = {
  id: string;
  email: string;
  usedAt: string | null;
  expiresAt: string;
  createdAt: string;
  organisation: { name: string } | null;
  invitedBy: { name: string };
};

type Organisation = { id: string; name: string };

function inviteStatus(invite: Invite) {
  if (invite.usedAt) return "used";
  if (new Date(invite.expiresAt) < new Date()) return "expired";
  return "pending";
}

export default function InvitesPage() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [orgId, setOrgId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [newInviteUrl, setNewInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    const [invRes, orgRes] = await Promise.all([
      fetch("/api/admin/invites").then((r) => r.json()),
      fetch("/api/admin/organisations").then((r) => r.json()),
    ]);
    if (invRes.success) setInvites(invRes.data);
    if (orgRes.success) setOrgs(orgRes.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createInvite() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, organisationId: orgId || undefined, expiryDays: 7 }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.success) {
      setNewInviteUrl(json.data.inviteUrl);
      setEmail("");
      setOrgId("");
      load();
    } else {
      setError(json.error?.message ?? "Failed to create invite");
    }
  }

  async function revokeInvite(id: string) {
    if (!confirm("Revoke this invite?")) return;
    await fetch(`/api/admin/invites/${id}`, { method: "DELETE" });
    load();
  }

  function copyUrl() {
    if (!newInviteUrl) return;
    navigator.clipboard.writeText(newInviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const statusBadge = (invite: Invite) => {
    const s = inviteStatus(invite);
    if (s === "used") return <Badge className="bg-green-100 text-green-700 border-0"><CheckCircle2 className="h-3 w-3 mr-1" />Used</Badge>;
    if (s === "expired") return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Expired</Badge>;
    return <Badge className="bg-blue-100 text-blue-700 border-0"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Invites</h1>
          <p className="text-sm text-slate-500 mt-0.5">Generate invite links for beta users</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setNewInviteUrl(null); setError(null); } }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-[#1A56DB] to-[#E4168A] text-white hover:opacity-90 border-0">
              <Plus className="h-4 w-4 mr-2" />New invite
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Generate invite link</DialogTitle>
            </DialogHeader>

            {newInviteUrl ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">Invite link created. Share this link with the user — it expires in 7 days and can only be used once.</p>
                <div className="flex gap-2">
                  <Input value={newInviteUrl} readOnly className="text-xs font-mono" />
                  <Button size="sm" variant="outline" onClick={copyUrl}>
                    {copied ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <Button className="w-full" variant="outline" onClick={() => { setNewInviteUrl(null); setOpen(false); }}>
                  Done
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                <div className="space-y-1.5">
                  <Label htmlFor="inv-email">Email address</Label>
                  <Input
                    id="inv-email"
                    type="email"
                    placeholder="user@agency.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Organisation (optional)</Label>
                  <Select value={orgId} onValueChange={setOrgId}>
                    <SelectTrigger>
                      <SelectValue placeholder="No organisation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No organisation</SelectItem>
                      {orgs.map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full bg-gradient-to-r from-[#1A56DB] to-[#E4168A] text-white hover:opacity-90 border-0"
                  onClick={createInvite}
                  disabled={saving || !email}
                >
                  {saving ? "Creating…" : "Generate invite link"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Email</TableHead>
                <TableHead>Organisation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Invited by</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-400 py-8">
                    <Mail className="h-6 w-6 mx-auto mb-2 opacity-40" />
                    No invites yet
                  </TableCell>
                </TableRow>
              )}
              {invites.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium text-sm">{inv.email}</TableCell>
                  <TableCell className="text-sm text-slate-500">{inv.organisation?.name ?? "—"}</TableCell>
                  <TableCell>{statusBadge(inv)}</TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">{inv.invitedBy.name}</TableCell>
                  <TableCell>
                    {inviteStatus(inv) === "pending" && (
                      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => revokeInvite(inv.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
