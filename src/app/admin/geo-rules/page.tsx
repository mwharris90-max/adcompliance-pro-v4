"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { format, differenceInDays } from "date-fns";
import { Search, Plus, CheckCircle, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

type RuleStatus = "ALLOWED" | "RESTRICTED" | "PROHIBITED" | "UNKNOWN";

const STATUS_CONFIG: Record<RuleStatus, { label: string; color: string }> = {
  ALLOWED: { label: "Allowed", color: "bg-green-100 text-green-800 border-green-200" },
  RESTRICTED: { label: "Restricted", color: "bg-amber-100 text-amber-800 border-amber-200" },
  PROHIBITED: { label: "Prohibited", color: "bg-red-100 text-red-800 border-red-200" },
  UNKNOWN: { label: "Unknown", color: "bg-slate-100 text-slate-600 border-slate-200" },
};

const AGE_TARGETING_OPTIONS = ["NONE", "13+", "16+", "18+", "21+", "25+"];

const AUDIENCE_RESTRICTION_OPTIONS = [
  "No children's targeting",
  "No lookalike of minors",
  "No interest targeting to under-18s",
  "Opt-out of data-driven targeting",
  "No retargeting",
];

interface Restrictions {
  ageTargeting?: string;
  timeRestrictions?: { restricted: boolean; startTime?: string; endTime?: string; timezoneNote?: string };
  mandatoryDisclaimer?: { required: boolean; text?: string };
  seasonalRestrictions?: string;
  audienceRestrictions?: string[];
}

interface GeoRule {
  id: string;
  status: RuleStatus;
  restrictions: Restrictions | null;
  notes: string | null;
  legislationUrl: string | null;
  lastVerifiedAt: string | null;
  country: { id: string; name: string; code: string };
  category: { id: string; name: string };
  platform: { id: string; name: string; slug: string } | null;
}

interface Country { id: string; name: string; code: string }
interface Category { id: string; name: string }
interface Platform { id: string; name: string }

export default function GeoRulesPage() {
  const [rules, setRules] = useState<GeoRule[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editRule, setEditRule] = useState<GeoRule | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GeoRule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Edit state
  const [editStatus, setEditStatus] = useState<RuleStatus>("UNKNOWN");
  const [editNotes, setEditNotes] = useState("");
  const [editLegUrl, setEditLegUrl] = useState("");
  const [ageTargeting, setAgeTargeting] = useState("NONE");
  const [timeRestricted, setTimeRestricted] = useState(false);
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [timezoneNote, setTimezoneNote] = useState("");
  const [disclaimerRequired, setDisclaimerRequired] = useState(false);
  const [disclaimerText, setDisclaimerText] = useState("");
  const [seasonalRestrictions, setSeasonalRestrictions] = useState("");
  const [audienceRestrictions, setAudienceRestrictions] = useState<string[]>([]);

  // Create state
  const [newCountryId, setNewCountryId] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newPlatformId, setNewPlatformId] = useState("none");

  const fetchRules = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (countryFilter !== "all") params.set("countryId", countryFilter);
    if (search) params.set("search", search);
    if (statusFilter !== "all") params.set("status", statusFilter);
    fetch(`/api/admin/geo-rules?${params}`)
      .then((r) => r.json())
      .then((json) => { if (json.success) setRules(json.data); })
      .finally(() => setLoading(false));
  }, [countryFilter, search, statusFilter]);

  useEffect(() => {
    const t = setTimeout(fetchRules, 300);
    return () => clearTimeout(t);
  }, [fetchRules]);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/countries").then((r) => r.json()),
      fetch("/api/admin/categories").then((r) => r.json()),
      fetch("/api/admin/platform-rules").then((r) => r.json()),
    ]).then(([countriesJson, categoriesJson, rulesJson]) => {
      if (countriesJson.success) setCountries(countriesJson.data);
      if (categoriesJson.success) setAllCategories(categoriesJson.data);
      if (rulesJson.success) {
        const ps = new Map<string, Platform>();
        rulesJson.data.forEach((r: { platform: Platform }) => ps.set(r.platform.id, r.platform));
        setPlatforms(Array.from(ps.values()));
      }
    });
  }, []);

  function openEdit(rule: GeoRule) {
    setEditRule(rule);
    setEditStatus(rule.status);
    setEditNotes(rule.notes ?? "");
    setEditLegUrl(rule.legislationUrl ?? "");
    const r = rule.restrictions ?? {};
    setAgeTargeting(r.ageTargeting ?? "NONE");
    setTimeRestricted(r.timeRestrictions?.restricted ?? false);
    setTimeStart(r.timeRestrictions?.startTime ?? "");
    setTimeEnd(r.timeRestrictions?.endTime ?? "");
    setTimezoneNote(r.timeRestrictions?.timezoneNote ?? "");
    setDisclaimerRequired(r.mandatoryDisclaimer?.required ?? false);
    setDisclaimerText(r.mandatoryDisclaimer?.text ?? "");
    setSeasonalRestrictions(r.seasonalRestrictions ?? "");
    setAudienceRestrictions(r.audienceRestrictions ?? []);
    setError(null);
    setSheetOpen(true);
  }

  function buildRestrictions(): Restrictions | null {
    const r: Restrictions = {};
    if (ageTargeting !== "NONE") r.ageTargeting = ageTargeting;
    if (timeRestricted) r.timeRestrictions = { restricted: true, startTime: timeStart, endTime: timeEnd, timezoneNote };
    if (disclaimerRequired) r.mandatoryDisclaimer = { required: true, text: disclaimerText };
    if (seasonalRestrictions) r.seasonalRestrictions = seasonalRestrictions;
    if (audienceRestrictions.length > 0) r.audienceRestrictions = audienceRestrictions;
    return Object.keys(r).length > 0 ? r : null;
  }

  function saveEdit(markVerified = false) {
    if (!editRule) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/geo-rules/${editRule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          restrictions: buildRestrictions(),
          notes: editNotes || null,
          legislationUrl: editLegUrl || null,
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

  function toggleAudience(option: string) {
    setAudienceRestrictions((prev) =>
      prev.includes(option) ? prev.filter((a) => a !== option) : [...prev, option]
    );
  }

  async function createRule() {
    if (!newCountryId || !newCategoryId) return;
    const res = await fetch("/api/admin/geo-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        countryId: newCountryId,
        categoryId: newCategoryId,
        platformId: newPlatformId === "none" ? null : newPlatformId,
      }),
    });
    const json = await res.json();
    if (json.success) {
      setCreateOpen(false);
      fetchRules();
      openEdit(json.data);
    } else {
      setError(json.error?.message ?? "Create failed");
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      await fetch(`/api/admin/geo-rules/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      fetchRules();
    });
  }

  const isOutdated = (date: string | null) =>
    date ? differenceInDays(new Date(), new Date(date)) > 60 : false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Geographic Rules</h1>
          <p className="text-slate-500 mt-1">Manage country-specific compliance rules by category and platform.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Rule
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search categories..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={countryFilter} onValueChange={setCountryFilter}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All countries" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Countries</SelectItem>
            {countries.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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
              <TableHead>Country</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Restrictions</TableHead>
              <TableHead>Last Verified</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline-block text-slate-400" />
                </TableCell>
              </TableRow>
            ) : rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-400">No rules found.</TableCell>
              </TableRow>
            ) : (
              rules.map((rule) => {
                const outdated = isOutdated(rule.lastVerifiedAt);
                const r = rule.restrictions ?? {};
                return (
                  <TableRow
                    key={rule.id}
                    className={`cursor-pointer hover:bg-slate-50 ${outdated ? "bg-amber-50" : ""}`}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('[data-noedit]')) return;
                      openEdit(rule);
                    }}
                  >
                    <TableCell className="font-medium text-sm">
                      {rule.country.code} {rule.country.name}
                    </TableCell>
                    <TableCell className="text-sm">{rule.category.name}</TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {rule.platform?.name ?? <span className="text-slate-300">All</span>}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_CONFIG[rule.status].color}`}>
                        {STATUS_CONFIG[rule.status].label}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      <div className="flex gap-1 flex-wrap">
                        {r.ageTargeting && r.ageTargeting !== "NONE" && (
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded">{r.ageTargeting}</span>
                        )}
                        {r.timeRestrictions?.restricted && (
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded">Time</span>
                        )}
                        {r.mandatoryDisclaimer?.required && (
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded">Disclaimer</span>
                        )}
                        {r.audienceRestrictions && r.audienceRestrictions.length > 0 && (
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded">{r.audienceRestrictions.length} audience</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={`text-xs ${outdated ? "text-amber-700 font-medium" : "text-slate-500"}`}>
                      {rule.lastVerifiedAt
                        ? format(new Date(rule.lastVerifiedAt), "dd MMM yyyy")
                        : <span className="text-slate-400">Never</span>}
                      {outdated && <span className="ml-1 text-amber-600">(outdated)</span>}
                    </TableCell>
                    <TableCell data-noedit>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-400 hover:text-red-600"
                        onClick={() => setDeleteTarget(rule)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
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
        <SheetContent className="w-[520px] sm:w-[580px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editRule?.country.code} {editRule?.country.name} × {editRule?.category.name}
              {editRule?.platform && <span className="text-slate-500 font-normal ml-1">({editRule.platform.name})</span>}
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

            {/* Age Targeting */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Age Targeting Required</Label>
              <Select value={ageTargeting} onValueChange={setAgeTargeting}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGE_TARGETING_OPTIONS.map((a) => <SelectItem key={a} value={a}>{a === "NONE" ? "No restriction" : a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Time Restrictions */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Switch id="timeRestricted" checked={timeRestricted} onCheckedChange={setTimeRestricted} />
                <Label htmlFor="timeRestricted" className="text-sm font-medium">Time restrictions apply</Label>
              </div>
              {timeRestricted && (
                <div className="pl-4 space-y-2 border-l-2 border-slate-200">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Start time</Label>
                      <Input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">End time</Label>
                      <Input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} />
                    </div>
                  </div>
                  <Input placeholder="Timezone note (e.g. 'Local time')" value={timezoneNote} onChange={(e) => setTimezoneNote(e.target.value)} />
                </div>
              )}
            </div>

            {/* Mandatory Disclaimer */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Switch id="disclaimer" checked={disclaimerRequired} onCheckedChange={setDisclaimerRequired} />
                <Label htmlFor="disclaimer" className="text-sm font-medium">Mandatory disclaimer</Label>
              </div>
              {disclaimerRequired && (
                <Textarea
                  rows={3}
                  placeholder="Disclaimer text..."
                  value={disclaimerText}
                  onChange={(e) => setDisclaimerText(e.target.value)}
                />
              )}
            </div>

            {/* Seasonal Restrictions */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Seasonal Restrictions <span className="text-slate-400 font-normal">(optional)</span></Label>
              <Input
                placeholder="e.g. Prohibited during Ramadan"
                value={seasonalRestrictions}
                onChange={(e) => setSeasonalRestrictions(e.target.value)}
              />
            </div>

            {/* Audience Restrictions */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Audience Restrictions</Label>
              <div className="space-y-2">
                {AUDIENCE_RESTRICTION_OPTIONS.map((option) => (
                  <div key={option} className="flex items-center gap-2">
                    <Checkbox
                      id={option}
                      checked={audienceRestrictions.includes(option)}
                      onCheckedChange={() => toggleAudience(option)}
                    />
                    <Label htmlFor={option} className="text-sm font-normal">{option}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Notes</Label>
              <Textarea rows={4} placeholder="Additional notes..." value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
            </div>

            {/* Legislation URL */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Legislation Reference URL</Label>
              <Input type="url" placeholder="https://..." value={editLegUrl} onChange={(e) => setEditLegUrl(e.target.value)} />
            </div>

            {editRule?.lastVerifiedAt && (
              <p className="text-xs text-slate-500">
                Last verified: {format(new Date(editRule.lastVerifiedAt), "dd MMM yyyy")}
              </p>
            )}
          </div>

          <SheetFooter className="mt-8 flex-col gap-2 sm:flex-col">
            <Button variant="outline" className="w-full gap-2" onClick={() => saveEdit(true)} disabled={isPending}>
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
            <DialogTitle>Add Geographic Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Select value={newCountryId} onValueChange={setNewCountryId}>
                <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>
                  {countries.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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
            <div className="space-y-1.5">
              <Label>Platform <span className="text-slate-400 font-normal">(optional)</span></Label>
              <Select value={newPlatformId} onValueChange={setNewPlatformId}>
                <SelectTrigger><SelectValue placeholder="All platforms" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All platforms</SelectItem>
                  {platforms.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createRule} disabled={!newCountryId || !newCategoryId}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this rule?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.country.name} × {deleteTarget?.category.name} will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
