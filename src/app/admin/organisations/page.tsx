"use client";

import { useEffect, useState } from "react";
import { Plus, Building2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Org = {
  id: string;
  name: string;
  slug: string;
  monthlyLimit: number;
  active: boolean;
  _count: { users: number; invites: number };
};

export default function OrganisationsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editOrg, setEditOrg] = useState<Org | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [limit, setLimit] = useState("100");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/organisations").then((r) => r.json());
    if (res.success) setOrgs(res.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditOrg(null);
    setName(""); setSlug(""); setLimit("100"); setError(null);
    setOpen(true);
  }

  function openEdit(org: Org) {
    setEditOrg(org);
    setName(org.name); setSlug(org.slug); setLimit(String(org.monthlyLimit)); setError(null);
    setOpen(true);
  }

  async function save() {
    setSaving(true); setError(null);
    if (editOrg) {
      const res = await fetch(`/api/admin/organisations/${editOrg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, monthlyLimit: parseInt(limit) }),
      }).then((r) => r.json());
      if (!res.success) { setError(res.error?.message ?? "Failed"); setSaving(false); return; }
    } else {
      const res = await fetch("/api/admin/organisations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, monthlyLimit: parseInt(limit) }),
      }).then((r) => r.json());
      if (!res.success) { setError(res.error?.message ?? "Failed"); setSaving(false); return; }
    }
    setSaving(false); setOpen(false); load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Organisations</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage beta organisations and their monthly limits</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="bg-gradient-to-r from-[#1A56DB] to-[#E4168A] text-white hover:opacity-90 border-0">
              <Plus className="h-4 w-4 mr-2" />New organisation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editOrg ? "Edit organisation" : "New organisation"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input placeholder="Acme Agency" value={name} onChange={(e) => {
                  setName(e.target.value);
                  if (!editOrg) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
                }} />
              </div>
              {!editOrg && (
                <div className="space-y-1.5">
                  <Label>Slug</Label>
                  <Input placeholder="acme-agency" value={slug} onChange={(e) => setSlug(e.target.value)} />
                  <p className="text-xs text-slate-400">Unique identifier, lowercase letters, numbers and hyphens only</p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Monthly check limit</Label>
                <Input type="number" min={1} value={limit} onChange={(e) => setLimit(e.target.value)} />
              </div>
              <Button className="w-full bg-gradient-to-r from-[#1A56DB] to-[#E4168A] text-white hover:opacity-90 border-0" onClick={save} disabled={saving || !name || (!editOrg && !slug)}>
                {saving ? "Saving…" : editOrg ? "Save changes" : "Create organisation"}
              </Button>
            </div>
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
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Monthly limit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-400 py-8">
                    <Building2 className="h-6 w-6 mx-auto mb-2 opacity-40" />
                    No organisations yet
                  </TableCell>
                </TableRow>
              )}
              {orgs.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell className="text-sm text-slate-500 font-mono">{org.slug}</TableCell>
                  <TableCell className="text-sm text-slate-500">{org._count.users}</TableCell>
                  <TableCell className="text-sm text-slate-500">{org.monthlyLimit}/month</TableCell>
                  <TableCell>
                    {org.active
                      ? <Badge className="bg-green-100 text-green-700 border-0">Active</Badge>
                      : <Badge variant="secondary">Inactive</Badge>}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(org)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
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
