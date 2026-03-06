"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Ban,
  Search,
  Loader2,
  Save,
  Globe,
  MonitorPlay,
  MessageSquare,
  Send,
  ExternalLink,
  ChevronRight,
  X,
  Sparkles,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
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
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface ProhibitionConfig {
  id: string;
  warningTitle: string;
  warningMessage: string;
  confirmationMessage: string;
  detectionGuidance: string | null;
  detectionExamples: DetectionExample[] | null;
  strictness: number;
  chatHistory: ChatMessage[] | null;
}

interface DetectionExample {
  content: string;
  verdict: "prohibited" | "allowed";
  reason: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Prohibition {
  ruleType: "geo" | "platform";
  ruleId: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  countryId: string | null;
  countryName: string | null;
  countryCode: string | null;
  platformId: string | null;
  platformName: string | null;
  notes: string | null;
  legislationUrl: string | null;
  config: ProhibitionConfig | null;
}

export default function ProhibitionsPage() {
  const [prohibitions, setProhibitions] = useState<Prohibition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedProhibition, setSelectedProhibition] = useState<Prohibition | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);

  const fetchProhibitions = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/prohibitions");
    const data = await res.json();
    if (data.success) setProhibitions(data.prohibitions);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProhibitions();
  }, [fetchProhibitions]);

  const filtered = prohibitions.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.categoryName.toLowerCase().includes(q) ||
      (p.countryName?.toLowerCase().includes(q) ?? false) ||
      (p.platformName?.toLowerCase().includes(q) ?? false) ||
      (p.notes?.toLowerCase().includes(q) ?? false)
    );
  });

  // Group by category
  const grouped = new Map<string, Prohibition[]>();
  for (const p of filtered) {
    const existing = grouped.get(p.categoryName) ?? [];
    existing.push(p);
    grouped.set(p.categoryName, existing);
  }

  const handleSelect = (p: Prohibition) => {
    setSelectedProhibition(p);
    setEditSheetOpen(true);
  };

  const handleConfigSaved = (p: Prohibition, config: ProhibitionConfig) => {
    setProhibitions((prev) =>
      prev.map((item) =>
        item.ruleId === p.ruleId && item.ruleType === p.ruleType
          ? { ...item, config }
          : item
      )
    );
    setSelectedProhibition((prev) =>
      prev && prev.ruleId === p.ruleId && prev.ruleType === p.ruleType
        ? { ...prev, config }
        : prev
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Ban className="h-6 w-6 text-red-600" />
          Prohibitions
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage prohibited advertising categories. Customise user-facing warnings and AI detection guidance.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by category, country, or platform..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Stats */}
      <div className="flex gap-4">
        <div className="bg-white rounded-lg border px-4 py-3">
          <p className="text-xs text-slate-500">Total Prohibitions</p>
          <p className="text-2xl font-bold text-red-600">{prohibitions.length}</p>
        </div>
        <div className="bg-white rounded-lg border px-4 py-3">
          <p className="text-xs text-slate-500">Configured</p>
          <p className="text-2xl font-bold text-emerald-600">
            {prohibitions.filter((p) => p.config).length}
          </p>
        </div>
        <div className="bg-white rounded-lg border px-4 py-3">
          <p className="text-xs text-slate-500">Unconfigured</p>
          <p className="text-2xl font-bold text-amber-600">
            {prohibitions.filter((p) => !p.config).length}
          </p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-[220px]">Category</TableHead>
                <TableHead className="w-[150px]">Jurisdiction</TableHead>
                <TableHead className="w-[120px]">Platform</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(grouped.entries()).map(([categoryName, items]) => (
                items.map((p, idx) => (
                  <TableRow
                    key={`${p.ruleType}:${p.ruleId}`}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => handleSelect(p)}
                  >
                    <TableCell className="font-medium">
                      {idx === 0 ? (
                        <span className="text-slate-900">{categoryName}</span>
                      ) : (
                        <span className="text-slate-300">↳</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.ruleType === "geo" ? (
                        <div className="flex items-center gap-1.5">
                          <Globe className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-sm">
                            {p.countryName}
                            {p.countryCode && (
                              <span className="text-slate-400 ml-1">({p.countryCode})</span>
                            )}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">All</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.platformName ? (
                        <div className="flex items-center gap-1.5">
                          <MonitorPlay className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-sm">{p.platformName}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">All</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-slate-600 truncate max-w-[300px]">
                        {p.notes || "—"}
                      </p>
                    </TableCell>
                    <TableCell>
                      {p.config ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-[10px]">
                          Configured
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-slate-400">
                          Default
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </TableCell>
                  </TableRow>
                ))
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-400 py-8">
                    {search ? "No prohibitions match your search." : "No prohibitions found."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Sheet */}
      {selectedProhibition && (
        <EditSheet
          prohibition={selectedProhibition}
          open={editSheetOpen}
          onOpenChange={setEditSheetOpen}
          onSaved={handleConfigSaved}
        />
      )}
    </div>
  );
}

// ─── Edit Sheet with AI Chat ────────────────────────────────────────────────

interface EditSheetProps {
  prohibition: Prohibition;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (p: Prohibition, config: ProhibitionConfig) => void;
}

function EditSheet({ prohibition, open, onOpenChange, onSaved }: EditSheetProps) {
  const [tab, setTab] = useState<"text" | "detection" | "chat">("text");
  const [saving, setSaving] = useState(false);

  // Form state
  const [warningTitle, setWarningTitle] = useState("");
  const [warningMessage, setWarningMessage] = useState("");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [detectionGuidance, setDetectionGuidance] = useState("");
  const [strictness, setStrictness] = useState(50);
  const [detectionExamples, setDetectionExamples] = useState<DetectionExample[]>([]);

  // Chat state
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [suggestedUpdate, setSuggestedUpdate] = useState<Record<string, unknown> | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Config ID (if exists)
  const [configId, setConfigId] = useState<string | null>(null);

  // Initialize form from prohibition config
  useEffect(() => {
    const c = prohibition.config;
    setWarningTitle(c?.warningTitle ?? "Regulatory restriction detected");
    setWarningMessage(
      c?.warningMessage ??
        "Your selected categories include jurisdictions where certain types of advertising are prohibited by law."
    );
    setConfirmationMessage(
      c?.confirmationMessage ?? "I confirm my adverts do not contravene this regulation"
    );
    setDetectionGuidance(c?.detectionGuidance ?? "");
    setStrictness(c?.strictness ?? 50);
    setDetectionExamples(c?.detectionExamples ?? []);
    setChatHistory(c?.chatHistory ?? []);
    setConfigId(c?.id ?? null);
    setSuggestedUpdate(null);
  }, [prohibition]);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      categoryId: prohibition.categoryId,
      countryId: prohibition.countryId,
      platformId: prohibition.platformId,
      warningTitle,
      warningMessage,
      confirmationMessage,
      detectionGuidance: detectionGuidance || null,
      detectionExamples: detectionExamples.length > 0 ? detectionExamples : null,
      strictness,
    };

    let res: Response;
    if (configId) {
      res = await fetch(`/api/admin/prohibitions/${configId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch("/api/admin/prohibitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    const data = await res.json();
    if (data.success && data.config) {
      setConfigId(data.config.id);
      onSaved(prohibition, data.config);
    }
    setSaving(false);
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;

    // Ensure config exists first
    let currentConfigId = configId;
    if (!currentConfigId) {
      const res = await fetch("/api/admin/prohibitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: prohibition.categoryId,
          countryId: prohibition.countryId,
          platformId: prohibition.platformId,
        }),
      });
      const data = await res.json();
      if (data.success && data.config) {
        currentConfigId = data.config.id;
        setConfigId(data.config.id);
        onSaved(prohibition, data.config);
      }
    }

    if (!currentConfigId) return;

    const msg = chatInput.trim();
    setChatInput("");
    setChatHistory((prev) => [...prev, { role: "user", content: msg }]);
    setChatLoading(true);
    setSuggestedUpdate(null);

    const res = await fetch(`/api/admin/prohibitions/${currentConfigId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg }),
    });

    const data = await res.json();
    if (data.success) {
      setChatHistory(data.history);
      if (data.suggestedUpdate) {
        setSuggestedUpdate(data.suggestedUpdate);
      }
    }
    setChatLoading(false);
  };

  const handleApplySuggestion = () => {
    if (!suggestedUpdate) return;
    if (suggestedUpdate.warningTitle) setWarningTitle(suggestedUpdate.warningTitle as string);
    if (suggestedUpdate.warningMessage) setWarningMessage(suggestedUpdate.warningMessage as string);
    if (suggestedUpdate.confirmationMessage)
      setConfirmationMessage(suggestedUpdate.confirmationMessage as string);
    if (suggestedUpdate.detectionGuidance)
      setDetectionGuidance(suggestedUpdate.detectionGuidance as string);
    if (suggestedUpdate.detectionExamples)
      setDetectionExamples(suggestedUpdate.detectionExamples as DetectionExample[]);
    if (suggestedUpdate.strictness) setStrictness(suggestedUpdate.strictness as number);
    setSuggestedUpdate(null);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const addExample = () => {
    setDetectionExamples((prev) => [
      ...prev,
      { content: "", verdict: "prohibited", reason: "" },
    ]);
  };

  const updateExample = (idx: number, field: keyof DetectionExample, value: string) => {
    setDetectionExamples((prev) =>
      prev.map((ex, i) => (i === idx ? { ...ex, [field]: value } : ex))
    );
  };

  const removeExample = (idx: number) => {
    setDetectionExamples((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="!max-w-2xl w-full flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <SheetTitle className="text-lg">
            <span className="text-red-600">Prohibition:</span> {prohibition.categoryName}
          </SheetTitle>
          <div className="flex items-center gap-2 mt-1">
            {prohibition.countryName && (
              <Badge variant="outline" className="text-xs">
                <Globe className="h-3 w-3 mr-1" />
                {prohibition.countryName} ({prohibition.countryCode})
              </Badge>
            )}
            {prohibition.platformName && (
              <Badge variant="outline" className="text-xs">
                <MonitorPlay className="h-3 w-3 mr-1" />
                {prohibition.platformName}
              </Badge>
            )}
            {prohibition.legislationUrl && (
              <a
                href={prohibition.legislationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#1A56DB] hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Source
              </a>
            )}
          </div>
          {prohibition.notes && (
            <p className="text-sm text-slate-500 mt-2">{prohibition.notes}</p>
          )}
        </SheetHeader>

        {/* Tabs */}
        <div className="flex border-b shrink-0">
          {(
            [
              { key: "text", label: "User-Facing Text", icon: null },
              { key: "detection", label: "Detection", icon: Sparkles },
              { key: "chat", label: "AI Chat", icon: MessageSquare },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex-1 px-4 py-2.5 text-sm font-medium transition-colors border-b-2",
                tab === t.key
                  ? "border-[#1A56DB] text-[#1A56DB]"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              <span className="flex items-center justify-center gap-1.5">
                {t.icon && <t.icon className="h-3.5 w-3.5" />}
                {t.label}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {tab === "text" && (
            <div className="space-y-5">
              <div>
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Warning Title
                </Label>
                <Input
                  value={warningTitle}
                  onChange={(e) => setWarningTitle(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Shown as the heading when this prohibition triggers.
                </p>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Warning Message
                </Label>
                <Textarea
                  value={warningMessage}
                  onChange={(e) => setWarningMessage(e.target.value)}
                  rows={4}
                  className="mt-1"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Detailed explanation shown to the user about why this prohibition exists.
                </p>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Confirmation Message
                </Label>
                <Textarea
                  value={confirmationMessage}
                  onChange={(e) => setConfirmationMessage(e.target.value)}
                  rows={2}
                  className="mt-1"
                />
                <p className="text-xs text-slate-400 mt-1">
                  The text of the confirmation button the user must click to proceed.
                </p>
              </div>

              {/* Preview */}
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">
                  Preview
                </p>
                <div className="flex items-start gap-3">
                  <Ban className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-900">{warningTitle}</p>
                    <p className="text-sm text-red-800 mt-1">{warningMessage}</p>
                  </div>
                </div>
                <div className="ml-8">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-amber-300 bg-amber-50 text-amber-800 text-sm">
                    {confirmationMessage}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "detection" && (
            <div className="space-y-6">
              <div>
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Detection Guidance
                </Label>
                <Textarea
                  value={detectionGuidance}
                  onChange={(e) => setDetectionGuidance(e.target.value)}
                  rows={6}
                  className="mt-1 font-mono text-sm"
                  placeholder="Describe how the AI should distinguish between adverts that genuinely violate this prohibition vs. those that are merely related to the topic. E.g.: 'Only flag ads that directly promote prescription medication purchase. Do NOT flag ads for pharmacies, health information, OTC medications, or healthcare services.'"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Strictness: {strictness}/100
                  </Label>
                </div>
                <Slider
                  value={[strictness]}
                  onValueChange={(v: number[]) => setStrictness(v[0])}
                  min={0}
                  max={100}
                  step={5}
                  className="mt-1"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>Lenient (fewer flags)</span>
                  <span>Strict (more flags)</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Detection Examples
                  </Label>
                  <Button size="sm" variant="outline" onClick={addExample} className="text-xs">
                    + Add Example
                  </Button>
                </div>

                {detectionExamples.length === 0 && (
                  <p className="text-sm text-slate-400 py-4 text-center">
                    No examples yet. Add examples to help the AI learn the boundary between
                    prohibited and allowed ads.
                  </p>
                )}

                <div className="space-y-3">
                  {detectionExamples.map((ex, idx) => (
                    <div key={idx} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateExample(idx, "verdict", "prohibited")}
                            className={cn(
                              "px-2 py-0.5 rounded text-xs font-medium transition-colors",
                              ex.verdict === "prohibited"
                                ? "bg-red-100 text-red-700"
                                : "bg-slate-100 text-slate-400 hover:text-slate-600"
                            )}
                          >
                            Prohibited
                          </button>
                          <button
                            onClick={() => updateExample(idx, "verdict", "allowed")}
                            className={cn(
                              "px-2 py-0.5 rounded text-xs font-medium transition-colors",
                              ex.verdict === "allowed"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-400 hover:text-slate-600"
                            )}
                          >
                            Allowed
                          </button>
                        </div>
                        <button
                          onClick={() => removeExample(idx)}
                          className="text-slate-300 hover:text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <Input
                        placeholder="Example ad content..."
                        value={ex.content}
                        onChange={(e) => updateExample(idx, "content", e.target.value)}
                        className="text-sm"
                      />
                      <Input
                        placeholder="Why this verdict..."
                        value={ex.reason}
                        onChange={(e) => updateExample(idx, "reason", e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "chat" && (
            <div className="flex flex-col h-full -my-4 -mx-6">
              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
                {chatHistory.length === 0 && (
                  <div className="text-center py-12 space-y-3">
                    <MessageSquare className="h-10 w-10 text-slate-200 mx-auto" />
                    <p className="text-sm text-slate-400">
                      Chat with AI to improve detection accuracy for this prohibition.
                    </p>
                    <div className="space-y-1.5">
                      {[
                        "How can I distinguish between legitimate and prohibited ads for this category?",
                        "Suggest detection guidance text",
                        "Help me write clearer warning messages",
                      ].map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setChatInput(suggestion);
                          }}
                          className="block w-full text-left text-sm text-[#1A56DB] hover:bg-blue-50 rounded-lg px-3 py-2 transition-colors"
                        >
                          &quot;{suggestion}&quot;
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed",
                        msg.role === "user"
                          ? "bg-[#1A56DB] text-white"
                          : "bg-slate-100 text-slate-800"
                      )}
                    >
                      <div className="whitespace-pre-wrap">{formatChatMessage(msg.content)}</div>
                    </div>
                  </div>
                ))}

                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 rounded-xl px-4 py-2.5">
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    </div>
                  </div>
                )}

                {suggestedUpdate && (
                  <div className="flex justify-center">
                    <Button
                      size="sm"
                      onClick={handleApplySuggestion}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Check className="h-3.5 w-3.5 mr-1.5" />
                      Apply suggested changes
                    </Button>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Chat input */}
              <div className="border-t px-6 py-3 shrink-0">
                <div className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendChat()}
                    placeholder="Ask AI about improving detection..."
                    disabled={chatLoading}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={handleSendChat}
                    disabled={!chatInput.trim() || chatLoading}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer save button (not for chat tab) */}
        {tab !== "chat" && (
          <div className="border-t px-6 py-3 shrink-0 flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              Save Configuration
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// Helper to strip the json:update blocks from display and render the rest
function formatChatMessage(content: string): string {
  return content.replace(/```json:update\s*\n[\s\S]*?\n```/g, "[Suggested configuration update]");
}
