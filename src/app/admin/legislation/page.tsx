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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Search,
  ExternalLink,
  MessageSquare,
  Send,
  CheckCircle,
  Loader2,
  Trash2,
} from "lucide-react";

interface Legislation {
  id: string;
  title: string;
  slug: string;
  type: string;
  maturity: string;
  active: boolean;
  sourceUrl: string | null;
  summary: string | null;
  jurisdiction: { id: string; name: string; code: string } | null;
  lastVerifiedAt: string | null;
  createdAt: string;
  complianceRules?: ComplianceRule[];
  chatHistory?: ChatMessage[];
  resourceLinks?: ResourceLink[];
}

interface ComplianceRule {
  id: string;
  title: string;
  status: string;
  maturity: string;
  category: { id: string; name: string; slug: string };
  platform?: { id: string; name: string } | null;
  country?: { id: string; name: string; code: string } | null;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  suggestedRules?: SuggestedRule[];
  timestamp: string;
}

interface SuggestedRule {
  title: string;
  description: string;
  categorySlug: string;
  categoryName: string;
  platformName?: string;
  countryName?: string;
  status: string;
  conditions?: Record<string, unknown>;
  aiCheckInstructions?: string;
}

interface ResourceLink {
  id: string;
  article?: { id: string; title: string; slug: string } | null;
  quiz?: { id: string; question: string } | null;
}

interface Country {
  id: string;
  name: string;
  code: string;
}

const LEG_TYPES = ["STATUTE", "REGULATION", "DIRECTIVE", "INDUSTRY_CODE", "GUIDANCE"];
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

export default function LegislationPage() {
  const [items, setItems] = useState<Legislation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [maturityFilter, setMaturityFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<Legislation | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (maturityFilter !== "all") params.set("maturity", maturityFilter);
    const res = await fetch(`/api/admin/legislation?${params}`);
    const json = await res.json();
    if (json.success) setItems(json.data);
    setLoading(false);
  }, [search, typeFilter, maturityFilter]);

  useEffect(() => {
    fetchItems();
    fetch("/api/admin/countries?approved=true")
      .then((r) => r.json())
      .then((j) => { if (j.success) setCountries(j.data); })
      .catch(() => {});
  }, [fetchItems]);

  const openDetail = async (id: string) => {
    const res = await fetch(`/api/admin/legislation/${id}`);
    const json = await res.json();
    if (json.success) setDetailItem(json.data);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Legislation Registry</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage legislation that affects advertising compliance rules
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Legislation</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Legislation</DialogTitle>
            </DialogHeader>
            <CreateForm
              countries={countries}
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
            placeholder="Search legislation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {LEG_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
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
              <TableHead>Type</TableHead>
              <TableHead>Jurisdiction</TableHead>
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
                  No legislation found
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
                  <TableCell className="text-sm text-slate-600">
                    {item.type.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.jurisdiction ? `${item.jurisdiction.name} (${item.jurisdiction.code})` : "--"}
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
        <SheetContent className="w-[700px] sm:max-w-[700px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{detailItem?.title}</SheetTitle>
          </SheetHeader>
          {detailItem && (
            <DetailView
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
function CreateForm({
  countries,
  onCreated,
}: {
  countries: Country[];
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    type: "STATUTE",
    jurisdictionId: "",
    sourceUrl: "",
    summary: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/admin/legislation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        jurisdictionId: form.jurisdictionId || null,
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Type</label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LEG_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Jurisdiction</label>
          <Select
            value={form.jurisdictionId}
            onValueChange={(v) => setForm({ ...form, jurisdictionId: v })}
          >
            <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
            <SelectContent>
              {countries.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
      <Button type="submit" disabled={saving} className="w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Create Legislation
      </Button>
    </form>
  );
}

/* ─── Detail View ─── */
function DetailView({
  item,
  onUpdate,
  onDeleted,
}: {
  item: Legislation;
  onUpdate: () => void;
  onDeleted: () => void;
}) {
  return (
    <Tabs defaultValue="overview" className="mt-4">
      <TabsList className="w-full">
        <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
        <TabsTrigger value="rules" className="flex-1">
          Rules ({item.complianceRules?.length ?? 0})
        </TabsTrigger>
        <TabsTrigger value="chat" className="flex-1">
          <MessageSquare className="h-3 w-3 mr-1" />AI Chat
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <OverviewTab item={item} onUpdate={onUpdate} onDeleted={onDeleted} />
      </TabsContent>
      <TabsContent value="rules">
        <RulesTab item={item} onUpdate={onUpdate} />
      </TabsContent>
      <TabsContent value="chat">
        <ChatTab item={item} onUpdate={onUpdate} />
      </TabsContent>
    </Tabs>
  );
}

/* ─── Overview Tab ─── */
function OverviewTab({
  item,
  onUpdate,
  onDeleted,
}: {
  item: Legislation;
  onUpdate: () => void;
  onDeleted: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const patchField = async (data: Record<string, unknown>) => {
    setSaving(true);
    await fetch(`/api/admin/legislation/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    onUpdate();
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this legislation? This cannot be undone.")) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/legislation/${item.id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) {
      onDeleted();
    } else {
      alert(json.error?.message ?? "Delete failed");
    }
    setDeleting(false);
  };

  return (
    <div className="space-y-4 mt-3">
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

      <div className="text-sm space-y-2">
        <p><span className="font-medium">Type:</span> {item.type.replace(/_/g, " ")}</p>
        <p><span className="font-medium">Jurisdiction:</span> {item.jurisdiction?.name ?? "Not specified"}</p>
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

      <div className="pt-4 border-t">
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={deleting}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          {deleting ? "Deleting..." : "Delete Legislation"}
        </Button>
      </div>
    </div>
  );
}

/* ─── Rules Tab ─── */
function RulesTab({ item, onUpdate }: { item: Legislation; onUpdate: () => void }) {
  const rules = item.complianceRules ?? [];
  const [confirmingRuleId, setConfirmingRuleId] = useState<string | null>(null);

  const patchRule = async (ruleId: string, data: Record<string, unknown>) => {
    await fetch(`/api/admin/compliance-rules/${ruleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    onUpdate();
  };

  const deleteRule = async (ruleId: string) => {
    await fetch(`/api/admin/compliance-rules/${ruleId}`, { method: "DELETE" });
    setConfirmingRuleId(null);
    onUpdate();
  };

  return (
    <div className="mt-3">
      {rules.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">
          No rules derived yet. Use the AI Chat tab to analyze this legislation and suggest rules.
        </p>
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
                    {rule.platform && (
                      <span className="text-xs text-slate-500">{rule.platform.name}</span>
                    )}
                    {rule.country && (
                      <span className="text-xs text-slate-500">{rule.country.name}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Select
                    value={rule.maturity}
                    onValueChange={(v) => patchRule(rule.id, { maturity: v })}
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
  );
}

/* ─── Chat Tab ─── */
function ChatTab({ item, onUpdate }: { item: Legislation; onUpdate: () => void }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [localHistory, setLocalHistory] = useState<ChatMessage[]>(
    (item.chatHistory as ChatMessage[]) ?? []
  );
  const [savingRules, setSavingRules] = useState<Record<number, boolean>>({});

  const sendMessage = async () => {
    if (!message.trim() || sending) return;
    const userMsg: ChatMessage = { role: "user", content: message, timestamp: new Date().toISOString() };
    setLocalHistory((prev) => [...prev, userMsg]);
    setMessage("");
    setSending(true);

    const res = await fetch(`/api/admin/legislation/${item.id}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMsg.content }),
    });

    const json = await res.json();
    if (json.success && json.history) {
      setLocalHistory(json.history);
    }
    setSending(false);
  };

  const acceptRule = async (rule: SuggestedRule, msgIndex: number, ruleIndex: number) => {
    const key = msgIndex * 100 + ruleIndex;
    setSavingRules((prev) => ({ ...prev, [key]: true }));

    await fetch("/api/admin/compliance-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categorySlug: rule.categorySlug,
        platformName: rule.platformName,
        countryName: rule.countryName,
        sourceType: "LEGISLATION",
        legislationId: item.id,
        status: rule.status,
        title: rule.title,
        description: rule.description,
        conditions: rule.conditions ?? null,
        aiCheckInstructions: rule.aiCheckInstructions ?? null,
      }),
    });

    setSavingRules((prev) => ({ ...prev, [key]: false }));
    onUpdate();
  };

  return (
    <div className="mt-3 flex flex-col" style={{ height: "calc(100vh - 220px)" }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-3">
        {localHistory.length === 0 && (
          <div className="text-center py-8">
            <MessageSquare className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">
              Ask the AI to analyze this legislation and suggest compliance rules.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Try: &quot;Analyze this legislation and suggest compliance rules&quot;
            </p>
          </div>
        )}
        {localHistory.map((msg, i) => (
          <div key={i}>
            <div
              className={`rounded-lg p-3 text-sm ${
                msg.role === "user"
                  ? "bg-blue-50 text-blue-900 ml-8"
                  : "bg-slate-50 text-slate-800 mr-4"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
            {msg.suggestedRules && msg.suggestedRules.length > 0 && (
              <div className="space-y-2 mt-2 mr-4">
                {msg.suggestedRules.map((rule, ri) => {
                  const key = i * 100 + ri;
                  return (
                    <div key={ri} className="border rounded-lg p-3 bg-white">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{rule.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{rule.description}</p>
                          <div className="flex gap-2 mt-1.5">
                            <Badge variant="outline" className={statusColor(rule.status)}>
                              {rule.status}
                            </Badge>
                            <span className="text-xs text-slate-500">{rule.categoryName}</span>
                            {rule.platformName && (
                              <span className="text-xs text-slate-500">{rule.platformName}</span>
                            )}
                            {rule.countryName && (
                              <span className="text-xs text-slate-500">{rule.countryName}</span>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-2 shrink-0"
                          disabled={savingRules[key]}
                          onClick={() => acceptRule(rule, i, ri)}
                        >
                          {savingRules[key] ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />Accept
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className="flex items-center gap-2 text-sm text-slate-400 mr-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t pt-3 flex gap-2">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask about this legislation..."
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          disabled={sending}
        />
        <Button onClick={sendMessage} disabled={sending || !message.trim()} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
