"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import {
  Plus,
  Search,
  ExternalLink,
  CheckCircle,
  Loader2,
  Trash2,
} from "lucide-react";

interface Platform {
  id: string;
  name: string;
}

interface PlatformPolicy {
  id: string;
  title: string;
  slug: string;
  platformId: string;
  sourceUrl: string | null;
  summary: string | null;
  maturity: string;
  active: boolean;
  lastVerifiedAt: string | null;
  createdAt: string;
  platform: { id: string; name: string };
  _count?: { complianceRules: number };
  complianceRules?: ComplianceRule[];
  legislation?: { legislation: { id: string; title: string; slug: string; type: string } }[];
  resourceLinks?: ResourceLink[];
}

interface ComplianceRule {
  id: string;
  title: string;
  status: string;
  maturity: string;
  category: { id: string; name: string; slug: string };
  country?: { id: string; name: string; code: string } | null;
}

interface ResourceLink {
  id: string;
  article?: { id: string; title: string; slug: string } | null;
  quiz?: { id: string; question: string } | null;
}

const MATURITY_OPTIONS = ["ALPHA", "BETA", "LIVE"];

function maturityColor(m: string) {
  if (m === "ALPHA") return "bg-amber-100 text-amber-800";
  if (m === "BETA") return "bg-blue-100 text-blue-800";
  return "bg-green-100 text-green-800";
}

function statusColor(s: string) {
  if (s === "PROHIBITED") return "bg-red-100 text-red-800";
  if (s === "RESTRICTED") return "bg-amber-100 text-amber-800";
  if (s === "ALLOWED") return "bg-green-100 text-green-800";
  return "bg-gray-100 text-gray-800";
}

export default function PlatformPoliciesPage() {
  const [items, setItems] = useState<PlatformPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [maturityFilter, setMaturityFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<PlatformPolicy | null>(null);
  const [platforms, setPlatforms] = useState<Platform[]>([]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (platformFilter !== "all") params.set("platformId", platformFilter);
    if (maturityFilter !== "all") params.set("maturity", maturityFilter);
    const res = await fetch(`/api/admin/platform-policies?${params}`);
    const json = await res.json();
    if (json.success) setItems(json.data);
    setLoading(false);
  }, [search, platformFilter, maturityFilter]);

  useEffect(() => {
    fetchItems();
    fetch("/api/platforms")
      .then((r) => r.json())
      .then((j) => { if (j.success) setPlatforms(j.data); })
      .catch(() => {});
  }, [fetchItems]);

  const openDetail = async (id: string) => {
    const res = await fetch(`/api/admin/platform-policies/${id}`);
    const json = await res.json();
    if (json.success) setDetailItem(json.data);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Policies</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage platform-specific advertising policies and their derived rules
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Policy</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Platform Policy</DialogTitle>
            </DialogHeader>
            <CreatePolicyForm
              platforms={platforms}
              onCreated={() => { setCreateOpen(false); fetchItems(); }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search policies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            {platforms.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={maturityFilter} onValueChange={setMaturityFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Maturity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {MATURITY_OPTIONS.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Rules</TableHead>
              <TableHead>Maturity</TableHead>
              <TableHead>Verified</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                  Loading...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                  No platform policies found
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow
                  key={item.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => openDetail(item.id)}
                >
                  <TableCell className="font-medium max-w-xs truncate">
                    {item.title}
                  </TableCell>
                  <TableCell className="text-sm">{item.platform.name}</TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {item._count?.complianceRules ?? 0}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={maturityColor(item.maturity)}>
                      {item.maturity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {item.lastVerifiedAt
                      ? new Date(item.lastVerifiedAt).toLocaleDateString()
                      : "Never"}
                  </TableCell>
                  <TableCell>
                    {item.sourceUrl && (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!detailItem} onOpenChange={(open) => { if (!open) setDetailItem(null); }}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{detailItem?.title}</SheetTitle>
          </SheetHeader>
          {detailItem && (
            <PolicyDetail
              item={detailItem}
              onUpdate={() => { openDetail(detailItem.id); fetchItems(); }}
              onDeleted={() => { setDetailItem(null); fetchItems(); }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ─── Create Form ─── */
function CreatePolicyForm({
  platforms,
  onCreated,
}: {
  platforms: Platform[];
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    platformId: "",
    sourceUrl: "",
    summary: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/admin/platform-policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        sourceUrl: form.sourceUrl || null,
        summary: form.summary || null,
      }),
    });
    if (res.ok) onCreated();
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-2">
      <div>
        <label className="text-sm font-medium">Platform</label>
        <Select
          value={form.platformId}
          onValueChange={(v) => setForm({ ...form, platformId: v })}
        >
          <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
          <SelectContent>
            {platforms.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium">Title</label>
        <Input
          value={form.title}
          onChange={(e) => {
            setForm({
              ...form,
              title: e.target.value,
              slug: e.target.value
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, ""),
            });
          }}
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium">Slug</label>
        <Input
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium">Source URL</label>
        <Input
          value={form.sourceUrl}
          onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
          placeholder="https://..."
        />
      </div>
      <div>
        <label className="text-sm font-medium">Summary</label>
        <Textarea
          value={form.summary}
          onChange={(e) => setForm({ ...form, summary: e.target.value })}
          rows={3}
        />
      </div>
      <Button type="submit" disabled={saving || !form.platformId} className="w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Create Policy
      </Button>
    </form>
  );
}

/* ─── Detail View ─── */
function PolicyDetail({
  item,
  onUpdate,
  onDeleted,
}: {
  item: PlatformPolicy;
  onUpdate: () => void;
  onDeleted: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingRuleId, setConfirmingRuleId] = useState<string | null>(null);
  const rules = item.complianceRules ?? [];

  const patchField = async (data: Record<string, unknown>) => {
    setSaving(true);
    await fetch(`/api/admin/platform-policies/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    onUpdate();
    setSaving(false);
  };

  const deleteRule = async (ruleId: string) => {
    await fetch(`/api/admin/compliance-rules/${ruleId}`, { method: "DELETE" });
    setConfirmingRuleId(null);
    onUpdate();
  };

  const handleDelete = async () => {
    if (!confirm("Delete this policy? This cannot be undone.")) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/platform-policies/${item.id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) {
      onDeleted();
    } else {
      alert(json.error?.message ?? "Delete failed");
    }
    setDeleting(false);
  };

  return (
    <div className="space-y-6 mt-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={maturityColor(item.maturity)}>
          {item.maturity}
        </Badge>
        <Select
          value={item.maturity}
          onValueChange={(v) => patchField({ maturity: v })}
        >
          <SelectTrigger className="w-28 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MATURITY_OPTIONS.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => patchField({ markVerified: true })}
          disabled={saving}
        >
          <CheckCircle className="h-3 w-3 mr-1" />Mark Verified
        </Button>
      </div>

      {/* Info */}
      <div className="text-sm space-y-2">
        <p><span className="font-medium">Platform:</span> {item.platform.name}</p>
        {item.sourceUrl && (
          <p>
            <span className="font-medium">Source: </span>
            <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              {item.sourceUrl}
            </a>
          </p>
        )}
        {item.lastVerifiedAt && (
          <p><span className="font-medium">Last verified:</span> {new Date(item.lastVerifiedAt).toLocaleString()}</p>
        )}
      </div>

      {item.summary && (
        <div>
          <h4 className="text-sm font-medium mb-1">Summary</h4>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{item.summary}</p>
        </div>
      )}

      {/* Linked Legislation */}
      {item.legislation && item.legislation.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-1">Linked Legislation</h4>
          <ul className="text-sm space-y-1">
            {item.legislation.map((link) => (
              <li key={link.legislation.id} className="text-slate-600">
                {link.legislation.title} ({link.legislation.type.replace(/_/g, " ")})
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Rules */}
      <div>
        <h4 className="text-sm font-medium mb-2">Derived Rules ({rules.length})</h4>
        {rules.length === 0 ? (
          <p className="text-sm text-slate-400">No rules derived from this policy yet.</p>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => (
              <div key={rule.id} className="border rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{rule.title}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className={statusColor(rule.status)}>
                        {rule.status}
                      </Badge>
                      <Badge variant="outline" className={maturityColor(rule.maturity)}>
                        {rule.maturity}
                      </Badge>
                      <span className="text-xs text-slate-500">{rule.category.name}</span>
                      {rule.country && (
                        <span className="text-xs text-slate-500">{rule.country.name}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Select
                      value={rule.maturity}
                      onValueChange={(v) => {
                        fetch(`/api/admin/compliance-rules/${rule.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ maturity: v }),
                        }).then(() => onUpdate());
                      }}
                    >
                      <SelectTrigger className="w-24 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MATURITY_OPTIONS.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {confirmingRuleId === rule.id ? (
                      <div className="flex gap-1">
                        <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => deleteRule(rule.id)}>
                          Confirm
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setConfirmingRuleId(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-red-500"
                        onClick={() => setConfirmingRuleId(rule.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resources */}
      {item.resourceLinks && item.resourceLinks.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-1">Linked Resources</h4>
          <ul className="text-sm space-y-1">
            {item.resourceLinks.map((rl) => (
              <li key={rl.id} className="text-slate-600">
                {rl.article ? `Article: ${rl.article.title}` : rl.quiz ? `Quiz: ${rl.quiz.question}` : "Resource"}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Delete */}
      <div className="pt-4 border-t">
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={deleting}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          {deleting ? "Deleting..." : "Delete Policy"}
        </Button>
      </div>
    </div>
  );
}
