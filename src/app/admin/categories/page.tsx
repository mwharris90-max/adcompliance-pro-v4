"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, Search, Pencil, Trash2, Loader2, ArrowLeft, RefreshCw,
  CheckCircle2, Clock, ShieldAlert, Ban, ShieldCheck,
  Wine, Heart, Landmark, Dice5, Leaf, Scale, Shield,
  HeartHandshake, Swords, Vote, Sparkles, UtensilsCrossed,
  ShoppingBag, Home, Tv, GraduationCap, Building2, Tag,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { MaturityBadge } from "@/components/checker/MaturityBadge";

// ─── Icon mapping ─────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Wine, Heart, Landmark, Dice5, Leaf, Scale, Shield,
  HeartHandshake, Swords, Vote, Sparkles, UtensilsCrossed,
  ShoppingBag, Home, Tv, GraduationCap, Building2,
};

function GroupIcon({ name, className }: { name: string | null; className?: string }) {
  const Icon = name && ICON_MAP[name] ? ICON_MAP[name] : Tag;
  return <Icon className={className} />;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Maturity = "ALPHA" | "BETA" | "LIVE";

interface CategoryGroup {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconName: string | null;
  active: boolean;
  childCount: number;
  activeCount: number;
  reviewedCount: number;
  oldestReview: string | null;
  newestReview: string | null;
  restrictionLevel: "allowed" | "restricted" | "prohibited";
  maturity: Maturity;
}

interface CategoryChild {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  parentId: string | null;
  maturity: Maturity;
  lastReviewedAt: string | null;
  reviewedByName: string | null;
  ruleCount: number;
  restrictionLevel: "allowed" | "restricted" | "prohibited";
}

interface AiSuggestion {
  action: "add" | "update" | "merge";
  existingId?: string;
  name: string;
  slug: string;
  description: string;
  reasoning: string;
  platforms?: string[];
  suggestedStatus: string;
}

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  active: z.boolean(),
});
type FormData = z.infer<typeof formSchema>;

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function timeAgo(date: string | null): string {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function reviewFreshness(date: string | null): "fresh" | "stale" | "never" {
  if (!date) return "never";
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  return days < 90 ? "fresh" : "stale";
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const [view, setView] = useState<"groups" | "children">("groups");
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [children, setChildren] = useState<CategoryChild[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<CategoryGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CategoryChild | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryChild | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Maturity filter
  const [maturityFilter, setMaturityFilter] = useState<"all" | Maturity>("all");

  // Auto-update state
  const [autoUpdateOpen, setAutoUpdateOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [scanningAi, setScanningAi] = useState(false);
  const [appliedSlugs, setAppliedSlugs] = useState<Set<string>>(new Set());

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/categories?groupView=true${search ? `&search=${encodeURIComponent(search)}` : ""}`);
    const json = await res.json();
    if (json.success) setGroups(json.data);
    setLoading(false);
  }, [search]);

  const fetchChildren = useCallback(async (groupId: string) => {
    setLoading(true);
    const res = await fetch(`/api/admin/categories?parentId=${groupId}${search ? `&search=${encodeURIComponent(search)}` : ""}`);
    const json = await res.json();
    if (json.success) setChildren(json.data);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    if (view === "groups") {
      const t = setTimeout(fetchGroups, 300);
      return () => clearTimeout(t);
    } else if (selectedGroup) {
      const t = setTimeout(() => fetchChildren(selectedGroup.id), 300);
      return () => clearTimeout(t);
    }
  }, [view, selectedGroup, fetchGroups, fetchChildren, search]);

  const openGroup = (group: CategoryGroup) => {
    setSelectedGroup(group);
    setView("children");
    setSearch("");
  };

  const goBack = () => {
    setView("groups");
    setSelectedGroup(null);
    setSearch("");
  };

  // ─── Form handlers ───────────────────────────────────────────────────────

  const {
    register, handleSubmit, reset, setValue, watch,
    formState: { errors: formErrors },
  } = useForm<FormData>({ resolver: zodResolver(formSchema) });

  const nameValue = watch("name");
  useEffect(() => {
    if (!editTarget) setValue("slug", toSlug(nameValue ?? ""));
  }, [nameValue, editTarget, setValue]);

  function openCreate() {
    setEditTarget(null);
    reset({ name: "", description: "", slug: "", active: true });
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(cat: CategoryChild) {
    setEditTarget(cat);
    reset({ name: cat.name, description: cat.description ?? "", slug: cat.slug, active: cat.active });
    setError(null);
    setDialogOpen(true);
  }

  const onSubmit = (data: FormData) => {
    setError(null);
    startTransition(async () => {
      const url = editTarget ? `/api/admin/categories/${editTarget.id}` : "/api/admin/categories";
      const method = editTarget ? "PATCH" : "POST";
      const payload = editTarget ? data : { ...data, parentId: selectedGroup?.id };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (json.success) {
        setDialogOpen(false);
        if (selectedGroup) fetchChildren(selectedGroup.id);
      } else {
        setError(json.error?.message ?? "Something went wrong");
      }
    });
  };

  function markReviewed(catId: string) {
    fetch(`/api/admin/categories/${catId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markReviewed: true }),
    }).then(() => {
      if (selectedGroup) fetchChildren(selectedGroup.id);
    });
  }

  function markAllReviewed() {
    const unreviewed = children.filter((c) => reviewFreshness(c.lastReviewedAt) !== "fresh");
    Promise.all(
      unreviewed.map((c) =>
        fetch(`/api/admin/categories/${c.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markReviewed: true }),
        })
      )
    ).then(() => {
      if (selectedGroup) fetchChildren(selectedGroup.id);
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/categories/${deleteTarget.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setDeleteTarget(null);
        if (selectedGroup) fetchChildren(selectedGroup.id);
      } else {
        setError(json.error?.message ?? "Delete failed");
      }
    });
  }

  // ─── Auto-update ──────────────────────────────────────────────────────────

  async function runAutoUpdate() {
    setScanningAi(true);
    setSuggestions([]);
    setAppliedSlugs(new Set());
    const res = await fetch("/api/admin/categories/auto-update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentGroupId: selectedGroup?.id ?? null }),
    });
    const data = await res.json();
    if (data.success) {
      setSuggestions(data.suggestions);
    }
    setScanningAi(false);
    setAutoUpdateOpen(true);
  }

  async function applySuggestion(s: AiSuggestion) {
    if (s.action === "add" && selectedGroup) {
      await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: s.name,
          slug: s.slug,
          description: s.description,
          parentId: selectedGroup.id,
          active: true,
        }),
      });
      setAppliedSlugs((prev) => new Set(prev).add(s.slug));
      fetchChildren(selectedGroup.id);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (view === "groups") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Categories</h1>
          <p className="text-slate-500 mt-1">
            Manage advertising compliance categories grouped by industry.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Search groups..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5">
            {(["all", "ALPHA", "BETA", "LIVE"] as const).map((level) => (
              <button
                key={level}
                onClick={() => setMaturityFilter(level)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  maturityFilter === level
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100",
                )}
              >
                {level === "all" ? "All" : level === "ALPHA" ? "Alpha" : level === "BETA" ? "Beta" : "Live"}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {groups.filter((g) => maturityFilter === "all" || g.maturity === maturityFilter).map((group) => {
              const reviewStatus = group.childCount === 0 ? "never"
                : group.reviewedCount === group.childCount && group.oldestReview && reviewFreshness(group.oldestReview) === "fresh" ? "fresh"
                : group.reviewedCount > 0 ? "stale"
                : "never";

              return (
                <button
                  key={group.id}
                  onClick={() => openGroup(group)}
                  className="group relative flex flex-col items-start rounded-xl border border-slate-200 bg-white p-5 text-left hover:border-slate-300 hover:shadow-md transition-all"
                >
                  {/* Restriction indicator + maturity badge */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    <MaturityBadge maturity={group.maturity} />
                    <div className={cn(
                      "w-2.5 h-2.5 rounded-full",
                      group.restrictionLevel === "prohibited" && "bg-red-500",
                      group.restrictionLevel === "restricted" && "bg-amber-500",
                      group.restrictionLevel === "allowed" && "bg-emerald-500",
                    )} />
                  </div>

                  {/* Icon */}
                  <div className={cn(
                    "rounded-xl p-3 mb-3",
                    group.restrictionLevel === "prohibited" && "bg-red-50",
                    group.restrictionLevel === "restricted" && "bg-amber-50",
                    group.restrictionLevel === "allowed" && "bg-emerald-50",
                  )}>
                    <GroupIcon
                      name={group.iconName}
                      className={cn(
                        "h-6 w-6",
                        group.restrictionLevel === "prohibited" && "text-red-600",
                        group.restrictionLevel === "restricted" && "text-amber-600",
                        group.restrictionLevel === "allowed" && "text-emerald-600",
                      )}
                    />
                  </div>

                  {/* Content */}
                  <h3 className="text-sm font-semibold text-slate-900 group-hover:text-slate-700">
                    {group.name}
                  </h3>
                  {group.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{group.description}</p>
                  )}

                  {/* Footer stats */}
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 w-full text-[11px] text-slate-400">
                    <span>{group.childCount} sub-categories</span>
                    <span className="flex items-center gap-1">
                      {reviewStatus === "fresh" ? (
                        <><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Reviewed</>
                      ) : reviewStatus === "stale" ? (
                        <><Clock className="h-3 w-3 text-amber-500" /> {group.reviewedCount}/{group.childCount} reviewed</>
                      ) : (
                        <><Clock className="h-3 w-3 text-slate-300" /> Not reviewed</>
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── Children view ────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={goBack} className="p-1.5">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            {selectedGroup && (
              <div className={cn(
                "rounded-xl p-2.5",
                selectedGroup.restrictionLevel === "prohibited" && "bg-red-50",
                selectedGroup.restrictionLevel === "restricted" && "bg-amber-50",
                selectedGroup.restrictionLevel === "allowed" && "bg-emerald-50",
              )}>
                <GroupIcon
                  name={selectedGroup.iconName}
                  className={cn(
                    "h-5 w-5",
                    selectedGroup.restrictionLevel === "prohibited" && "text-red-600",
                    selectedGroup.restrictionLevel === "restricted" && "text-amber-600",
                    selectedGroup.restrictionLevel === "allowed" && "text-emerald-600",
                  )}
                />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{selectedGroup?.name}</h1>
              <p className="text-sm text-slate-500">{selectedGroup?.description}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={runAutoUpdate} disabled={scanningAi}>
            {scanningAi ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
            Auto-update
          </Button>
          <select
            defaultValue=""
            onChange={(e) => {
              const maturity = e.target.value as Maturity;
              if (!maturity || !selectedGroup) return;
              Promise.all(
                children.map((c) =>
                  fetch(`/api/admin/categories/${c.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ maturity }),
                  })
                )
              ).then(() => fetchChildren(selectedGroup.id));
              e.target.value = "";
            }}
            className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option value="" disabled>Set all maturity…</option>
            <option value="ALPHA">Alpha</option>
            <option value="BETA">Beta</option>
            <option value="LIVE">Live</option>
          </select>
          <Button variant="outline" size="sm" onClick={markAllReviewed}>
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            Mark all reviewed
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Sub-category
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input placeholder="Search sub-categories..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Sub-categories table */}
      <div className="rounded-md border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Name</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[100px]">Maturity</TableHead>
              <TableHead className="text-center w-[80px]">Rules</TableHead>
              <TableHead className="w-[140px]">Last Reviewed</TableHead>
              <TableHead className="text-center w-[80px]">Active</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin inline-block" />
                </TableCell>
              </TableRow>
            ) : children.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-slate-400">No sub-categories found.</TableCell>
              </TableRow>
            ) : (
              children.map((cat) => {
                const freshness = reviewFreshness(cat.lastReviewedAt);
                return (
                  <TableRow key={cat.id} className={!cat.active ? "opacity-50" : undefined}>
                    <TableCell>
                      {cat.restrictionLevel === "prohibited" && <Ban className="h-3.5 w-3.5 text-red-500" />}
                      {cat.restrictionLevel === "restricted" && <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />}
                      {cat.restrictionLevel === "allowed" && <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{cat.name}</p>
                      {cat.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{cat.description}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "text-[10px] px-1.5",
                        cat.restrictionLevel === "prohibited" && "bg-red-100 text-red-700 border-red-200 hover:bg-red-100",
                        cat.restrictionLevel === "restricted" && "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100",
                        cat.restrictionLevel === "allowed" && "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
                      )}>
                        {cat.restrictionLevel === "prohibited" ? "Prohibited" : cat.restrictionLevel === "restricted" ? "Restricted" : "Allowed"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <select
                        value={cat.maturity}
                        onChange={(e) => {
                          const maturity = e.target.value as Maturity;
                          fetch(`/api/admin/categories/${cat.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ maturity }),
                          }).then(() => { if (selectedGroup) fetchChildren(selectedGroup.id); });
                        }}
                        className={cn(
                          "text-[11px] font-medium rounded-md border px-2 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1",
                          cat.maturity === "ALPHA" && "border-amber-200 bg-amber-50 text-amber-700 focus:ring-amber-300",
                          cat.maturity === "BETA" && "border-blue-200 bg-blue-50 text-blue-700 focus:ring-blue-300",
                          cat.maturity === "LIVE" && "border-emerald-200 bg-emerald-50 text-emerald-700 focus:ring-emerald-300",
                        )}
                      >
                        <option value="ALPHA">Alpha</option>
                        <option value="BETA">Beta</option>
                        <option value="LIVE">Live</option>
                      </select>
                    </TableCell>
                    <TableCell className="text-center text-xs text-slate-500">{cat.ruleCount}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          freshness === "fresh" && "bg-emerald-500",
                          freshness === "stale" && "bg-amber-500",
                          freshness === "never" && "bg-slate-300",
                        )} />
                        <span className="text-xs text-slate-500">{timeAgo(cat.lastReviewedAt)}</span>
                        {cat.reviewedByName && (
                          <span className="text-xs text-slate-400">by {cat.reviewedByName}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={cat.active}
                        onCheckedChange={() => {
                          fetch(`/api/admin/categories/${cat.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ active: !cat.active }),
                          }).then(() => { if (selectedGroup) fetchChildren(selectedGroup.id); });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Mark reviewed" onClick={() => markReviewed(cat.id)}>
                          <CheckCircle2 className={cn("h-3.5 w-3.5", freshness === "fresh" ? "text-emerald-400" : "text-slate-300")} />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(cat)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => setDeleteTarget(cat)} disabled={cat.ruleCount > 0}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Sub-category" : "New Sub-category"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input {...register("name")} />
              {formErrors.name && <p className="text-xs text-red-500">{formErrors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input {...register("slug")} className="font-mono text-sm" />
              {formErrors.slug && <p className="text-xs text-red-500">{formErrors.slug.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-slate-400 font-normal">(optional)</span></Label>
              <Textarea {...register("description")} rows={2} />
            </div>
            <div className="flex items-center gap-3">
              <Switch id="active" checked={watch("active")} onCheckedChange={(v) => setValue("active", v)} />
              <Label htmlFor="active">Active</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editTarget ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Auto-update suggestions dialog */}
      <Dialog open={autoUpdateOpen} onOpenChange={setAutoUpdateOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              AI Category Suggestions
            </DialogTitle>
          </DialogHeader>

          {suggestions.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">No suggestions — categories look comprehensive.</p>
          ) : (
            <div className="space-y-3">
              {suggestions.map((s, i) => {
                const applied = appliedSlugs.has(s.slug);
                return (
                  <div key={i} className={cn("rounded-lg border p-4 space-y-2", applied && "bg-emerald-50 border-emerald-200")}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            {s.action === "add" ? "New" : s.action === "update" ? "Update" : "Merge"}
                          </Badge>
                          <span className="font-medium text-sm">{s.name}</span>
                          <Badge className={cn(
                            "text-[10px]",
                            s.suggestedStatus === "PROHIBITED" && "bg-red-100 text-red-700 hover:bg-red-100",
                            s.suggestedStatus === "RESTRICTED" && "bg-amber-100 text-amber-700 hover:bg-amber-100",
                            s.suggestedStatus === "ALLOWED" && "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
                          )}>
                            {s.suggestedStatus}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{s.description}</p>
                      </div>
                      {s.action === "add" && !applied && (
                        <Button size="sm" variant="outline" onClick={() => applySuggestion(s)} className="shrink-0">
                          <Plus className="h-3.5 w-3.5 mr-1" /> Add
                        </Button>
                      )}
                      {applied && (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px]">Added</Badge>
                      )}
                    </div>
                    {/* AI reasoning */}
                    <div className="bg-slate-50 rounded-md px-3 py-2 text-xs text-slate-600">
                      <span className="font-medium text-slate-500">AI reasoning: </span>
                      {s.reasoning}
                    </div>
                    {s.platforms && s.platforms.length > 0 && (
                      <div className="flex gap-1">
                        {s.platforms.map((p) => (
                          <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAutoUpdateOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
