"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { Plus, Search, Loader2, Trash2, Eye, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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

type Verdict = "COMPLIANT" | "NON_COMPLIANT";

interface RubricRow {
  key: string;
  value: string;
}

interface TrainingExample {
  id: string;
  title: string;
  contentSample: string;
  imageUrl: string | null;
  verdict: Verdict;
  explanation: string;
  rubric: RubricRow[] | null;
  categoryId: string | null;
  platformId: string | null;
  countryId: string | null;
  active: boolean;
  version: number;
  category: { id: string; name: string } | null;
  platform: { id: string; name: string } | null;
  country: { id: string; name: string; code: string } | null;
  createdBy: { id: string; name: string };
}

interface Category { id: string; name: string }
interface Platform { id: string; name: string }
interface Country { id: string; name: string; code: string }

const VERDICT_CONFIG: Record<Verdict, { label: string; color: string }> = {
  COMPLIANT: { label: "Compliant", color: "bg-green-100 text-green-800 border-green-200" },
  NON_COMPLIANT: { label: "Non-Compliant", color: "bg-red-100 text-red-800 border-red-200" },
};

function emptyForm() {
  return {
    title: "",
    contentSample: "",
    imageUrl: "",
    verdict: "NON_COMPLIANT" as Verdict,
    explanation: "",
    rubric: [] as RubricRow[],
    categoryId: "",
    platformId: "",
    countryId: "",
    active: true,
  };
}

export default function AiTrainingPage() {
  const [examples, setExamples] = useState<TrainingExample[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [verdictFilter, setVerdictFilter] = useState("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [editExample, setEditExample] = useState<TrainingExample | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TrainingExample | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchExamples = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (categoryFilter !== "all") params.set("categoryId", categoryFilter);
    if (verdictFilter !== "all") params.set("verdict", verdictFilter);
    fetch(`/api/admin/training-examples?${params}`)
      .then((r) => r.json())
      .then((json) => { if (json.success) setExamples(json.data); })
      .finally(() => setLoading(false));
  }, [search, categoryFilter, verdictFilter]);

  useEffect(() => {
    const t = setTimeout(fetchExamples, 300);
    return () => clearTimeout(t);
  }, [fetchExamples]);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/categories").then((r) => r.json()),
      fetch("/api/admin/platform-rules?status=all").then((r) => r.json()),
      fetch("/api/admin/countries").then((r) => r.json()),
    ]).then(([catJson, rulesJson, countryJson]) => {
      if (catJson.success) setCategories(catJson.data);
      if (rulesJson.success) {
        const ps = new Map<string, Platform>();
        rulesJson.data.forEach((r: { platform: Platform }) => ps.set(r.platform.id, r.platform));
        setPlatforms(Array.from(ps.values()));
      }
      if (countryJson.success) setCountries(countryJson.data);
    });
  }, []);

  function openCreate() {
    setForm(emptyForm());
    setError(null);
    setCreateOpen(true);
  }

  function openEdit(ex: TrainingExample) {
    setEditExample(ex);
    setForm({
      title: ex.title,
      contentSample: ex.contentSample,
      imageUrl: ex.imageUrl ?? "",
      verdict: ex.verdict,
      explanation: ex.explanation,
      rubric: ex.rubric ?? [],
      categoryId: ex.categoryId ?? "",
      platformId: ex.platformId ?? "",
      countryId: ex.countryId ?? "",
      active: ex.active,
    });
    setError(null);
    setSheetOpen(true);
  }

  function addRubricRow() {
    setForm((f) => ({ ...f, rubric: [...f.rubric, { key: "", value: "" }] }));
  }

  function removeRubricRow(i: number) {
    setForm((f) => ({ ...f, rubric: f.rubric.filter((_, idx) => idx !== i) }));
  }

  function updateRubricRow(i: number, field: "key" | "value", val: string) {
    setForm((f) => ({
      ...f,
      rubric: f.rubric.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)),
    }));
  }

  function buildPayload() {
    return {
      title: form.title,
      contentSample: form.contentSample,
      imageUrl: form.imageUrl || null,
      verdict: form.verdict,
      explanation: form.explanation,
      rubric: form.rubric.length > 0 ? form.rubric : null,
      categoryId: form.categoryId || null,
      platformId: form.platformId || null,
      countryId: form.countryId || null,
      active: form.active,
    };
  }

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/training-examples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const json = await res.json();
      if (json.success) {
        setCreateOpen(false);
        fetchExamples();
      } else {
        setError(json.error?.message ?? "Create failed");
      }
    });
  }

  function handleSave() {
    if (!editExample) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/training-examples/${editExample.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const json = await res.json();
      if (json.success) {
        setSheetOpen(false);
        setEditExample(null);
        fetchExamples();
      } else {
        setError(json.error?.message ?? "Save failed");
      }
    });
  }

  async function toggleActive(ex: TrainingExample) {
    await fetch(`/api/admin/training-examples/${ex.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !ex.active }),
    });
    fetchExamples();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/admin/training-examples/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    if (sheetOpen && editExample?.id === deleteTarget.id) {
      setSheetOpen(false);
      setEditExample(null);
    }
    fetchExamples();
  }

  async function openPromptPreview(id: string) {
    setPreviewLoading(true);
    setPreviewOpen(true);
    setPreviewContent("");
    const res = await fetch(`/api/admin/training-examples/${id}/prompt-preview`);
    const json = await res.json();
    setPreviewContent(json.success ? json.data.promptBlock : "Error loading preview");
    setPreviewLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AI Training Examples</h1>
          <p className="text-slate-500 mt-1">
            Curate COMPLIANT / NON_COMPLIANT examples injected as few-shot context into the AI compliance layer.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Create Example
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search title or content..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={verdictFilter} onValueChange={setVerdictFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All verdicts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Verdicts</SelectItem>
            <SelectItem value="COMPLIANT">Compliant</SelectItem>
            <SelectItem value="NON_COMPLIANT">Non-Compliant</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Verdict</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline-block text-slate-400" />
                </TableCell>
              </TableRow>
            ) : examples.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                  No examples found. Create one to improve AI accuracy.
                </TableCell>
              </TableRow>
            ) : (
              examples.map((ex) => (
                <TableRow
                  key={ex.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("[data-noedit]")) return;
                    openEdit(ex);
                  }}
                >
                  <TableCell className="font-medium text-sm max-w-xs">
                    <p className="truncate">{ex.title}</p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{ex.contentSample.slice(0, 80)}…</p>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${VERDICT_CONFIG[ex.verdict].color}`}
                    >
                      {VERDICT_CONFIG[ex.verdict].label}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    <div className="flex flex-wrap gap-1">
                      {ex.category && (
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded">{ex.category.name}</span>
                      )}
                      {ex.platform && (
                        <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{ex.platform.name}</span>
                      )}
                      {ex.country && (
                        <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">{ex.country.code}</span>
                      )}
                      {!ex.category && !ex.platform && !ex.country && (
                        <span className="text-slate-400">Global</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded">v{ex.version}</span>
                  </TableCell>
                  <TableCell data-noedit>
                    <Switch
                      checked={ex.active}
                      onCheckedChange={() => toggleActive(ex)}
                    />
                  </TableCell>
                  <TableCell data-noedit className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(ex); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Create Dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Training Example</DialogTitle>
          </DialogHeader>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <ExampleForm
            form={form}
            setForm={setForm}
            categories={categories}
            platforms={platforms}
            countries={countries}
            onAddRubric={addRubricRow}
            onRemoveRubric={removeRubricRow}
            onUpdateRubric={updateRubricRow}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isPending || !form.title || !form.contentSample || !form.explanation}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Sheet ── */}
      <Sheet open={sheetOpen} onOpenChange={(v) => { setSheetOpen(v); if (!v) setEditExample(null); }}>
        <SheetContent className="w-[520px] sm:w-[580px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              Edit Example
              {editExample && (
                <span className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                  v{editExample.version}
                </span>
              )}
            </SheetTitle>
          </SheetHeader>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="mt-6">
            <ExampleForm
              form={form}
              setForm={setForm}
              categories={categories}
              platforms={platforms}
              countries={countries}
              onAddRubric={addRubricRow}
              onRemoveRubric={removeRubricRow}
              onUpdateRubric={updateRubricRow}
            />
          </div>

          <SheetFooter className="mt-8 flex-col gap-2 sm:flex-col">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => editExample && openPromptPreview(editExample.id)}
              disabled={previewLoading}
            >
              {previewLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              Preview in Prompt
            </Button>
            <Button
              variant="destructive"
              className="w-full gap-2"
              onClick={() => editExample && setDeleteTarget(editExample)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
            <Button
              className="w-full"
              onClick={handleSave}
              disabled={isPending || !form.title || !form.contentSample || !form.explanation}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save (creates new version)
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Delete Confirm Dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Example</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Are you sure you want to permanently delete &ldquo;{deleteTarget?.title}&rdquo;? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Prompt Preview Dialog ── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Prompt Block Preview</DialogTitle>
          </DialogHeader>
          {previewLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <pre className="text-xs bg-slate-900 text-slate-100 p-4 rounded-md overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
              {previewContent}
            </pre>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              <X className="h-4 w-4 mr-2" /> Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Shared form component ─────────────────────────────────────────────────────

interface ExampleFormProps {
  form: ReturnType<typeof emptyForm>;
  setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof emptyForm>>>;
  categories: Category[];
  platforms: Platform[];
  countries: Country[];
  onAddRubric: () => void;
  onRemoveRubric: (i: number) => void;
  onUpdateRubric: (i: number, field: "key" | "value", val: string) => void;
}

function ExampleForm({
  form,
  setForm,
  categories,
  platforms,
  countries,
  onAddRubric,
  onRemoveRubric,
  onUpdateRubric,
}: ExampleFormProps) {
  return (
    <div className="space-y-5">
      {/* Title */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Title *</Label>
        <Input
          placeholder="Brief descriptive title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
      </div>

      {/* Verdict */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Verdict *</Label>
        <div className="flex gap-2">
          {(["COMPLIANT", "NON_COMPLIANT"] as Verdict[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setForm((f) => ({ ...f, verdict: v }))}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium border transition-all ${
                form.verdict === v
                  ? VERDICT_CONFIG[v].color + " ring-2 ring-offset-1 ring-current"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {VERDICT_CONFIG[v].label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Sample */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Content Sample *</Label>
        <Textarea
          rows={4}
          placeholder="The ad copy / content that demonstrates this verdict..."
          value={form.contentSample}
          onChange={(e) => setForm((f) => ({ ...f, contentSample: e.target.value }))}
        />
      </div>

      {/* Explanation */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Explanation *</Label>
        <Textarea
          rows={3}
          placeholder="Why is this content compliant or non-compliant?"
          value={form.explanation}
          onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))}
        />
      </div>

      {/* Rubric */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Rubric Criteria</Label>
          <Button type="button" size="sm" variant="outline" onClick={onAddRubric}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Row
          </Button>
        </div>
        {form.rubric.length === 0 && (
          <p className="text-xs text-slate-400">No criteria yet. Add rows to specify key→value rules.</p>
        )}
        {form.rubric.map((row, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Input
              placeholder="Key (e.g. No health claims)"
              className="flex-1 text-sm"
              value={row.key}
              onChange={(e) => onUpdateRubric(i, "key", e.target.value)}
            />
            <Input
              placeholder="Value (e.g. content avoids efficacy claims)"
              className="flex-1 text-sm"
              value={row.value}
              onChange={(e) => onUpdateRubric(i, "value", e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
              onClick={() => onRemoveRubric(i)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      {/* Scope */}
      <div className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-md">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Scope (optional)</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Category</Label>
          <Select value={form.categoryId || "none"} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v === "none" ? "" : v }))}>
            <SelectTrigger className="text-sm"><SelectValue placeholder="Any category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Any category</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Platform</Label>
          <Select value={form.platformId || "none"} onValueChange={(v) => setForm((f) => ({ ...f, platformId: v === "none" ? "" : v }))}>
            <SelectTrigger className="text-sm"><SelectValue placeholder="Any platform" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Any platform</SelectItem>
              {platforms.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Country</Label>
          <Select value={form.countryId || "none"} onValueChange={(v) => setForm((f) => ({ ...f, countryId: v === "none" ? "" : v }))}>
            <SelectTrigger className="text-sm"><SelectValue placeholder="Any country" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Any country</SelectItem>
              {countries.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Image URL */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Image URL (optional)</Label>
        <Input
          type="url"
          placeholder="https://..."
          value={form.imageUrl}
          onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
        />
      </div>

      {/* Active */}
      <div className="flex items-center gap-3">
        <Switch
          checked={form.active}
          onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
        />
        <Label className="text-sm">Active (inject into AI checks)</Label>
      </div>
    </div>
  );
}
