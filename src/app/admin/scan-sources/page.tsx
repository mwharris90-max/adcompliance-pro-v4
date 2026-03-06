"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { format, formatDuration, intervalToDuration } from "date-fns";
import { Plus, Pencil, Trash2, Play, Loader2, CheckCircle2, AlertCircle, History, ChevronDown, ChevronUp } from "lucide-react";
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

interface Platform { id: string; name: string }
interface Country { id: string; name: string }
interface Category { id: string; name: string }

interface ScanSource {
  id: string;
  url: string;
  label: string;
  active: boolean;
  lastScannedAt: string | null;
  platform: Platform | null;
  country: Country | null;
  category: Category | null;
}

interface ScanResult {
  sourcesScanned: number;
  sourcesChanged: number;
  changesCreated: number;
  errors: { sourceUrl: string; error: string }[];
}

interface ScanLog {
  id: string;
  startedAt: string;
  completedAt: string | null;
  triggeredBy: "CRON" | "MANUAL";
  sourcesScanned: number;
  sourcesChanged: number;
  changesCreated: number;
  errorCount: number;
}

const formSchema = z.object({
  url: z.string().url("Please enter a valid URL"),
  label: z.string().min(1, "Label is required").max(200),
  platformId: z.string().optional(),
  countryId: z.string().optional(),
  categoryId: z.string().optional(),
  active: z.boolean(),
});
type FormData = z.infer<typeof formSchema>;

export default function ScanSourcesPage() {
  const [sources, setSources] = useState<ScanSource[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ScanSource | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScanSource | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchSources = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/scan-sources")
      .then((r) => r.json())
      .then((json) => { if (json.success) setSources(json.data); })
      .finally(() => setLoading(false));
  }, []);

  const fetchLogs = useCallback(() => {
    fetch("/api/admin/scan-logs")
      .then((r) => r.json())
      .then((json) => { if (json.success) setScanLogs(json.data); });
  }, []);

  useEffect(() => {
    fetchSources();
    fetchLogs();
    Promise.all([
      fetch("/api/admin/platform-rules").then((r) => r.json()),
      fetch("/api/admin/countries").then((r) => r.json()),
      fetch("/api/admin/categories").then((r) => r.json()),
    ]).then(([rulesJson, countriesJson, categoriesJson]) => {
      if (rulesJson.success) {
        const ps = new Map<string, Platform>();
        rulesJson.data.forEach((r: { platform: Platform }) => ps.set(r.platform.id, r.platform));
        setPlatforms(Array.from(ps.values()));
      }
      if (countriesJson.success) setCountries(countriesJson.data);
      if (categoriesJson.success) setCategories(categoriesJson.data);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchLogs]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { active: true },
  });

  function openCreate() {
    setEditTarget(null);
    reset({ url: "", label: "", platformId: "", countryId: "", categoryId: "", active: true });
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(source: ScanSource) {
    setEditTarget(source);
    reset({
      url: source.url,
      label: source.label,
      platformId: source.platform?.id ?? "",
      countryId: source.country?.id ?? "",
      categoryId: source.category?.id ?? "",
      active: source.active,
    });
    setFormError(null);
    setDialogOpen(true);
  }

  const onSubmit = (data: FormData) => {
    setFormError(null);
    startTransition(async () => {
      const payload = {
        ...data,
        platformId: data.platformId || null,
        countryId: data.countryId || null,
        categoryId: data.categoryId || null,
      };
      const url = editTarget ? `/api/admin/scan-sources/${editTarget.id}` : "/api/admin/scan-sources";
      const method = editTarget ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        setDialogOpen(false);
        fetchSources();
      } else {
        setFormError(json.error?.message ?? "Something went wrong");
      }
    });
  };

  function toggleActive(source: ScanSource) {
    setSources((prev) => prev.map((s) => s.id === source.id ? { ...s, active: !s.active } : s));
    fetch(`/api/admin/scan-sources/${source.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !source.active }),
    }).then((r) => r.json()).then((json) => {
      if (!json.success) fetchSources();
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      await fetch(`/api/admin/scan-sources/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      fetchSources();
    });
  }

  async function runScan() {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/admin/scan/run", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setScanResult(json.data);
        fetchSources();
        fetchLogs();
        setLogsExpanded(true);
      }
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Scan Sources</h1>
          <p className="text-slate-500 mt-1">URLs monitored for advertising policy changes. Scanned every 20 days automatically.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={runScan} disabled={scanning || sources.filter((s) => s.active).length === 0}>
            {scanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            {scanning ? "Scanning..." : "Run Scan Now"}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> Add Source
          </Button>
        </div>
      </div>

      {/* Scan result summary */}
      {scanResult && (
        <Alert className={scanResult.errors.length > 0 ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"}>
          <div className="flex items-start gap-2">
            {scanResult.errors.length > 0
              ? <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
              : <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />}
            <div>
              <AlertDescription className={scanResult.errors.length > 0 ? "text-amber-800" : "text-green-800"}>
                Scan complete — {scanResult.sourcesScanned} source{scanResult.sourcesScanned !== 1 ? "s" : ""} scanned,{" "}
                {scanResult.sourcesChanged} changed,{" "}
                {scanResult.changesCreated} proposed change{scanResult.changesCreated !== 1 ? "s" : ""} created.
                {scanResult.errors.length > 0 && (
                  <span className="block mt-1 text-xs">
                    {scanResult.errors.length} error{scanResult.errors.length !== 1 ? "s" : ""}:{" "}
                    {scanResult.errors.map((e) => `${e.sourceUrl}: ${e.error}`).join(", ")}
                  </span>
                )}
              </AlertDescription>
            </div>
          </div>
        </Alert>
      )}

      {/* Table */}
      <div className="rounded-md border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label / URL</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Last Scanned</TableHead>
              <TableHead className="text-center">Active</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline-block text-slate-400" />
                </TableCell>
              </TableRow>
            ) : sources.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                  No scan sources yet. Add URLs to monitor for policy changes.
                </TableCell>
              </TableRow>
            ) : (
              sources.map((source) => (
                <TableRow key={source.id} className={!source.active ? "opacity-50" : undefined}>
                  <TableCell>
                    <p className="font-medium text-sm">{source.label}</p>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline max-w-xs truncate block"
                    >
                      {source.url}
                    </a>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">{source.platform?.name ?? <span className="text-slate-300">—</span>}</TableCell>
                  <TableCell className="text-sm text-slate-500">{source.country?.name ?? <span className="text-slate-300">—</span>}</TableCell>
                  <TableCell className="text-sm text-slate-500">{source.category?.name ?? <span className="text-slate-300">—</span>}</TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {source.lastScannedAt
                      ? format(new Date(source.lastScannedAt), "dd MMM yyyy HH:mm")
                      : <span className="text-slate-300">Never</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={source.active} onCheckedChange={() => toggleActive(source)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(source)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:text-red-600" onClick={() => setDeleteTarget(source)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Scan History */}
      <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          onClick={() => setLogsExpanded((v) => !v)}
        >
          <span className="flex items-center gap-2">
            <History className="h-4 w-4 text-slate-400" />
            Scan History
            {scanLogs.length > 0 && (
              <span className="ml-1 text-xs text-slate-400 font-normal">({scanLogs.length} run{scanLogs.length !== 1 ? "s" : ""})</span>
            )}
          </span>
          {logsExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>

        {logsExpanded && (
          <div className="border-t border-slate-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead className="text-center">Scanned</TableHead>
                  <TableHead className="text-center">Changed</TableHead>
                  <TableHead className="text-center">Proposals</TableHead>
                  <TableHead className="text-center">Errors</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scanLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-slate-400 text-sm">
                      No scan runs recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  scanLogs.map((log) => {
                    const duration = log.completedAt
                      ? formatDuration(
                          intervalToDuration({
                            start: new Date(log.startedAt),
                            end: new Date(log.completedAt),
                          }),
                          { format: ["minutes", "seconds"], zero: true }
                        ) || "< 1s"
                      : "—";
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-slate-600">
                          {format(new Date(log.startedAt), "dd MMM yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.triggeredBy === "MANUAL" ? "default" : "secondary"} className="text-xs">
                            {log.triggeredBy === "MANUAL" ? "Manual" : "Cron"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm">{log.sourcesScanned}</TableCell>
                        <TableCell className="text-center text-sm">{log.sourcesChanged}</TableCell>
                        <TableCell className="text-center text-sm">
                          {log.changesCreated > 0 ? (
                            <span className="font-semibold text-amber-600">{log.changesCreated}</span>
                          ) : (
                            log.changesCreated
                          )}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {log.errorCount > 0 ? (
                            <span className="font-semibold text-red-500">{log.errorCount}</span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">{duration}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Scan Source" : "Add Scan Source"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {formError && <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert>}

            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input {...register("label")} placeholder='e.g. "Instagram Advertising Policies"' />
              {errors.label && <p className="text-xs text-red-500">{errors.label.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>URL</Label>
              <Input {...register("url")} placeholder="https://..." type="url" />
              {errors.url && <p className="text-xs text-red-500">{errors.url.message}</p>}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Platform</Label>
                <Select value={watch("platformId") ?? ""} onValueChange={(v) => setValue("platformId", v === "none" ? "" : v)}>
                  <SelectTrigger className="text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any</SelectItem>
                    {platforms.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Country</Label>
                <Select value={watch("countryId") ?? ""} onValueChange={(v) => setValue("countryId", v === "none" ? "" : v)}>
                  <SelectTrigger className="text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any</SelectItem>
                    {countries.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Category</Label>
                <Select value={watch("categoryId") ?? ""} onValueChange={(v) => setValue("categoryId", v === "none" ? "" : v)}>
                  <SelectTrigger className="text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any</SelectItem>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch id="active" checked={watch("active")} onCheckedChange={(v) => setValue("active", v)} />
              <Label htmlFor="active">Active</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editTarget ? "Save Changes" : "Add Source"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deleteTarget?.label}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the scan source. Existing proposed changes from this source will remain.</AlertDialogDescription>
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
