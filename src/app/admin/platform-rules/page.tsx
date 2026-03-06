"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { format, differenceInDays } from "date-fns";
import { Search, Plus, CheckCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

type RuleStatus = "ALLOWED" | "RESTRICTED" | "PROHIBITED" | "UNKNOWN";

interface Conditions {
  ageGate?: { required: boolean; minimumAge?: number };
  disclaimer?: { required: boolean; text?: string };
  priorApproval?: boolean;
}

interface PlatformRule {
  id: string;
  status: RuleStatus;
  notes: string | null;
  conditions: Conditions | null;
  referenceUrl: string | null;
  lastVerifiedAt: string | null;
  platform: { id: string; name: string; slug: string };
  category: { id: string; name: string; slug: string };
}

interface Platform {
  id: string;
  name: string;
}
interface Category {
  id: string;
  name: string;
}

const STATUS_CONFIG: Record<RuleStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
  ALLOWED: { label: "Allowed", variant: "default", color: "bg-green-100 text-green-800 border-green-200" },
  RESTRICTED: { label: "Restricted", variant: "secondary", color: "bg-amber-100 text-amber-800 border-amber-200" },
  PROHIBITED: { label: "Prohibited", variant: "destructive", color: "bg-red-100 text-red-800 border-red-200" },
  UNKNOWN: { label: "Unknown", variant: "outline", color: "bg-slate-100 text-slate-600 border-slate-200" },
};

const AGE_OPTIONS = [13, 16, 18, 21, 25];

export default function PlatformRulesPage() {
  const [rules, setRules] = useState<PlatformRule[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editRule, setEditRule] = useState<PlatformRule | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Edit form state
  const [editStatus, setEditStatus] = useState<RuleStatus>("UNKNOWN");
  const [editNotes, setEditNotes] = useState("");
  const [editRefUrl, setEditRefUrl] = useState("");
  const [ageGateEnabled, setAgeGateEnabled] = useState(false);
  const [ageGateAge, setAgeGateAge] = useState(18);
  const [disclaimerEnabled, setDisclaimerEnabled] = useState(false);
  const [disclaimerText, setDisclaimerText] = useState("");
  const [priorApproval, setPriorApproval] = useState(false);

  // Create form state
  const [newPlatformId, setNewPlatformId] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");

  const fetchRules = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (platformFilter !== "all") params.set("platformId", platformFilter);
    if (search) params.set("search", search);
    if (statusFilter !== "all") params.set("status", statusFilter);
    fetch(`/api/admin/platform-rules?${params}`)
      .then((r) => r.json())
      .then((json) => { if (json.success) setRules(json.data); })
      .finally(() => setLoading(false));
  }, [platformFilter, search, statusFilter]);

  useEffect(() => {
    const t = setTimeout(fetchRules, 300);
    return () => clearTimeout(t);
  }, [fetchRules]);

  // Load platforms and categories for create dialog
  useEffect(() => {
    Promise.all([
      fetch("/api/admin/platform-rules?status=all").then(r => r.json()),
    ]).then(([rulesJson]) => {
      if (rulesJson.success) {
        const ps = new Map<string, Platform>();
        rulesJson.data.forEach((r: PlatformRule) => ps.set(r.platform.id, r.platform));
        setPlatforms(Array.from(ps.values()));
      }
    });
    fetch("/api/admin/categories")
      .then((r) => r.json())
      .then((json) => { if (json.success) setAllCategories(json.data); });
  }, []);

  function openEdit(rule: PlatformRule) {
    setEditRule(rule);
    setEditStatus(rule.status);
    setEditNotes(rule.notes ?? "");
    setEditRefUrl(rule.referenceUrl ?? "");
    const c = rule.conditions ?? {};
    setAgeGateEnabled(c.ageGate?.required ?? false);
    setAgeGateAge(c.ageGate?.minimumAge ?? 18);
    setDisclaimerEnabled(c.disclaimer?.required ?? false);
    setDisclaimerText(c.disclaimer?.text ?? "");
    setPriorApproval(c.priorApproval ?? false);
    setError(null);
    setSheetOpen(true);
  }

  function buildConditions(): Conditions | null {
    if (editStatus !== "RESTRICTED") return null;
    const c: Conditions = {};
    if (ageGateEnabled) c.ageGate = { required: true, minimumAge: ageGateAge };
    if (disclaimerEnabled) c.disclaimer = { required: true, text: disclaimerText };
    if (priorApproval) c.priorApproval = true;
    return Object.keys(c).length > 0 ? c : null;
  }

  function saveEdit(markVerified = false) {
    if (!editRule) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/platform-rules/${editRule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          notes: editNotes || null,
          conditions: buildConditions(),
          referenceUrl: editRefUrl || null,
          markVerified,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSheetOpen(false);
        fetchRules();
      } else {
        setError(json.error?.message ?? "Save failed");
      }
    });
  }

  async function bulkSetStatus(status: RuleStatus) {
    await Promise.all(
      Array.from(selectedIds).map((id) =>
        fetch(`/api/admin/platform-rules/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        })
      )
    );
    setSelectedIds(new Set());
    fetchRules();
  }

  async function createRule() {
    if (!newPlatformId || !newCategoryId) return;
    const res = await fetch("/api/admin/platform-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platformId: newPlatformId, categoryId: newCategoryId }),
    });
    const json = await res.json();
    if (json.success) {
      setCreateOpen(false);
      setNewPlatformId("");
      setNewCategoryId("");
      fetchRules();
      // Open edit sheet for new rule
      openEdit(json.data);
    } else {
      setError(json.error?.message ?? "Create failed");
    }
  }

  const isOutdated = (date: string | null) =>
    date ? differenceInDays(new Date(), new Date(date)) > 60 : false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Rules</h1>
          <p className="text-slate-500 mt-1">Manage compliance rules per platform and category.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Rule
        </Button>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <span className="text-sm text-blue-800 font-medium">{selectedIds.size} selected</span>
          <div className="flex gap-2">
            {(["ALLOWED", "RESTRICTED", "PROHIBITED", "UNKNOWN"] as RuleStatus[]).map((s) => (
              <Button key={s} size="sm" variant="outline" onClick={() => bulkSetStatus(s)}
                className={`text-xs ${STATUS_CONFIG[s].color}`}>
                Set {STATUS_CONFIG[s].label}
              </Button>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs">
            Clear
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search categories..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All platforms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            {platforms.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {(["ALLOWED", "RESTRICTED", "PROHIBITED", "UNKNOWN"] as RuleStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={rules.length > 0 && selectedIds.size === rules.length}
                  onCheckedChange={(v) => setSelectedIds(v ? new Set(rules.map((r) => r.id)) : new Set())}
                />
              </TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Conditions</TableHead>
              <TableHead>Last Verified</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline-block text-slate-400" />
                </TableCell>
              </TableRow>
            ) : rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400">No rules found.</TableCell>
              </TableRow>
            ) : (
              rules.map((rule) => {
                const outdated = isOutdated(rule.lastVerifiedAt);
                return (
                  <TableRow
                    key={rule.id}
                    className={`cursor-pointer hover:bg-slate-50 ${outdated ? "bg-amber-50" : ""}`}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('[data-noedit]')) return;
                      openEdit(rule);
                    }}
                  >
                    <TableCell data-noedit>
                      <Checkbox
                        checked={selectedIds.has(rule.id)}
                        onCheckedChange={(v) => {
                          const next = new Set(selectedIds);
                          v ? next.add(rule.id) : next.delete(rule.id);
                          setSelectedIds(next);
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-sm">{rule.platform.name}</TableCell>
                    <TableCell className="text-sm">{rule.category.name}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_CONFIG[rule.status].color}`}>
                        {STATUS_CONFIG[rule.status].label}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {rule.conditions ? (
                        <div className="flex gap-1 flex-wrap">
                          {rule.conditions.ageGate?.required && (
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{rule.conditions.ageGate.minimumAge}+</span>
                          )}
                          {rule.conditions.disclaimer?.required && (
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">Disclaimer</span>
                          )}
                          {rule.conditions.priorApproval && (
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">Prior Approval</span>
                          )}
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell className={`text-xs ${outdated ? "text-amber-700 font-medium" : "text-slate-500"}`}>
                      {rule.lastVerifiedAt
                        ? format(new Date(rule.lastVerifiedAt), "dd MMM yyyy")
                        : <span className="text-slate-400">Never</span>}
                      {outdated && <span className="ml-1 text-amber-600">(outdated)</span>}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[480px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editRule?.platform.name} × {editRule?.category.name}
            </SheetTitle>
          </SheetHeader>

          {error && <Alert variant="destructive" className="mt-4"><AlertDescription>{error}</AlertDescription></Alert>}

          <div className="mt-6 space-y-6">
            {/* Status */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Status</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["ALLOWED", "RESTRICTED", "PROHIBITED", "UNKNOWN"] as RuleStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setEditStatus(s)}
                    className={`px-3 py-2 rounded-md text-sm font-medium border transition-all ${
                      editStatus === s
                        ? STATUS_CONFIG[s].color + " ring-2 ring-offset-1 ring-current"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {STATUS_CONFIG[s].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Conditions (only when Restricted) */}
            {editStatus === "RESTRICTED" && (
              <div className="space-y-4 p-4 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Conditions</p>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="ageGate"
                    checked={ageGateEnabled}
                    onCheckedChange={(v) => setAgeGateEnabled(!!v)}
                  />
                  <div className="flex-1">
                    <Label htmlFor="ageGate" className="text-sm font-medium">Age gate required</Label>
                    {ageGateEnabled && (
                      <Select value={String(ageGateAge)} onValueChange={(v) => setAgeGateAge(Number(v))}>
                        <SelectTrigger className="mt-2 w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AGE_OPTIONS.map((a) => <SelectItem key={a} value={String(a)}>{a}+</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="disclaimer"
                    checked={disclaimerEnabled}
                    onCheckedChange={(v) => setDisclaimerEnabled(!!v)}
                  />
                  <div className="flex-1">
                    <Label htmlFor="disclaimer" className="text-sm font-medium">Disclaimer required</Label>
                    {disclaimerEnabled && (
                      <Textarea
                        className="mt-2 text-sm"
                        rows={3}
                        placeholder="Disclaimer text..."
                        value={disclaimerText}
                        onChange={(e) => setDisclaimerText(e.target.value)}
                      />
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Checkbox
                    id="priorApproval"
                    checked={priorApproval}
                    onCheckedChange={(v) => setPriorApproval(!!v)}
                  />
                  <Label htmlFor="priorApproval" className="text-sm font-medium">Prior approval required</Label>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Notes</Label>
              <Textarea
                rows={4}
                placeholder="Additional notes..."
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>

            {/* Reference URL */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Reference URL</Label>
              <Input
                type="url"
                placeholder="https://..."
                value={editRefUrl}
                onChange={(e) => setEditRefUrl(e.target.value)}
              />
            </div>

            {/* Last verified */}
            {editRule?.lastVerifiedAt && (
              <p className="text-xs text-slate-500">
                Last verified: {format(new Date(editRule.lastVerifiedAt), "dd MMM yyyy")}
              </p>
            )}
          </div>

          <SheetFooter className="mt-8 flex-col gap-2 sm:flex-col">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => saveEdit(true)}
              disabled={isPending}
            >
              <CheckCircle className="h-4 w-4" />
              Save & Mark Verified Today
            </Button>
            <Button className="w-full" onClick={() => saveEdit(false)} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Create Rule Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Platform Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <Select value={newPlatformId} onValueChange={setNewPlatformId}>
                <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
                <SelectContent>
                  {platforms.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={newCategoryId} onValueChange={setNewCategoryId}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {allCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createRule} disabled={!newPlatformId || !newCategoryId}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
