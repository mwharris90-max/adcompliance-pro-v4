"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Search,
  ChevronRight,
  ExternalLink,
  CheckCircle,
  Loader2,
  Trash2,
  Scale,
  FileText,
  Send,
  SearchCheck,
  RefreshCw,
  MessageSquare,
  AlertTriangle,
  Info,
} from "lucide-react";

/* ─── Types ─── */
interface CategoryGroup {
  id: string;
  name: string;
  slug: string;
  iconName: string | null;
  childCount: number;
  maturity: string;
  restrictionLevel: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  maturity: string;
  active: boolean;
  ruleCount: number;
  restrictionLevel: string;
}

interface ComplianceRule {
  id: string;
  title: string;
  description: string | null;
  status: string;
  maturity: string;
  sourceType: string;
  active: boolean;
  conditions: Record<string, unknown> | null;
  aiCheckInstructions: string | null;
  lastVerifiedAt: string | null;
  category: { id: string; name: string; slug: string };
  platform: { id: string; name: string } | null;
  country: { id: string; name: string; code: string } | null;
  legislation: { id: string; title: string; slug: string } | null;
  platformPolicy: { id: string; title: string; slug: string } | null;
}

interface SuggestedSource {
  title: string;
  type: string;
  jurisdiction: string;
  sourceUrl?: string;
  summary: string;
  relevance: string;
  keyProvisions?: string[];
}

interface Finding {
  area: string;
  issue: string;
  recommendation: string;
}

interface Assessment {
  needsUpdate: boolean;
  urgency: string;
  findings: Finding[];
  suggestedUpdate?: Record<string, unknown>;
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

function sourceIcon(type: string) {
  if (type === "LEGISLATION") return <Scale className="h-3.5 w-3.5 text-indigo-500" />;
  if (type === "PLATFORM_POLICY") return <FileText className="h-3.5 w-3.5 text-teal-500" />;
  return <FileText className="h-3.5 w-3.5 text-slate-400" />;
}

function sourceLabel(rule: ComplianceRule) {
  if (rule.legislation) return rule.legislation.title;
  if (rule.platformPolicy) return rule.platformPolicy.title;
  return "Independent";
}

function urgencyColor(u: string) {
  if (u === "HIGH") return "text-red-600 bg-red-50";
  if (u === "MEDIUM") return "text-amber-600 bg-amber-50";
  return "text-green-600 bg-green-50";
}

/* ─── Main Page ─── */
export default function CompliancePage() {
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [children, setChildren] = useState<Category[]>([]);
  const [rules, setRules] = useState<ComplianceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [rulesLoading, setRulesLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [maturityFilter, setMaturityFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>("");

  const [detailRule, setDetailRule] = useState<ComplianceRule | null>(null);

  useEffect(() => {
    fetch("/api/admin/categories?groupView=true")
      .then((r) => r.json())
      .then((j) => { if (j.success) setGroups(j.data); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedGroupId) { setChildren([]); return; }
    fetch(`/api/admin/categories?parentId=${selectedGroupId}`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setChildren(j.data); });
  }, [selectedGroupId]);

  const fetchRules = useCallback(async (categoryId: string) => {
    setRulesLoading(true);
    const res = await fetch(`/api/admin/compliance-rules?categoryId=${categoryId}`);
    const json = await res.json();
    if (json.success) setRules(json.data);
    setRulesLoading(false);
  }, []);

  useEffect(() => {
    if (selectedCategoryId) fetchRules(selectedCategoryId);
    else setRules([]);
  }, [selectedCategoryId, fetchRules]);

  const selectCategory = (cat: Category) => {
    setSelectedCategoryId(cat.id);
    setSelectedCategoryName(cat.name);
  };

  const filteredGroups = search
    ? groups.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))
    : groups;

  // Apply filters to rules
  const filteredRules = rules.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (sourceFilter !== "all" && r.sourceType !== sourceFilter) return false;
    if (maturityFilter !== "all" && r.maturity !== maturityFilter) return false;
    if (platformFilter !== "all") {
      if (platformFilter === "none" && r.platform) return false;
      if (platformFilter !== "none" && r.platform?.name !== platformFilter) return false;
    }
    if (countryFilter !== "all") {
      if (countryFilter === "none" && r.country) return false;
      if (countryFilter !== "none" && r.country?.code !== countryFilter) return false;
    }
    return true;
  });

  // Unique values for filter dropdowns
  const uniquePlatforms = [...new Set(rules.filter((r) => r.platform).map((r) => r.platform!.name))].sort();
  const uniqueCountries = [...new Set(rules.filter((r) => r.country).map((r) => r.country!.code))].sort();

  const legislationRules = filteredRules.filter((r) => r.sourceType === "LEGISLATION");
  const platformRules = filteredRules.filter((r) => r.sourceType === "PLATFORM_POLICY");
  const independentRules = filteredRules.filter((r) => r.sourceType === "PLATFORM_INDEPENDENT");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Compliance Rules</h1>
        <p className="text-sm text-slate-500 mt-1">
          Select a category to view and manage its legislation and platform policy rules
        </p>
      </div>

      <div className="flex gap-6">
        {/* Left: Category browser */}
        <div className="w-72 shrink-0">
          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search categories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="border rounded-lg bg-white max-h-[calc(100vh-220px)] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="divide-y">
                {filteredGroups.map((group) => (
                  <div key={group.id}>
                    <button
                      onClick={() => {
                        setSelectedGroupId(selectedGroupId === group.id ? null : group.id);
                        setSelectedCategoryId(null);
                        setSelectedCategoryName("");
                      }}
                      className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between ${
                        selectedGroupId === group.id ? "bg-slate-50" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium truncate">{group.name}</span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${maturityColor(group.maturity)}`}>
                          {group.maturity}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs text-slate-400">{group.childCount}</span>
                        <ChevronRight className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                          selectedGroupId === group.id ? "rotate-90" : ""
                        }`} />
                      </div>
                    </button>
                    {selectedGroupId === group.id && children.length > 0 && (
                      <div className="bg-slate-50 border-t">
                        {children.map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => selectCategory(cat)}
                            className={`w-full text-left pl-7 pr-3 py-2 text-sm hover:bg-slate-100 transition-colors flex items-center justify-between ${
                              selectedCategoryId === cat.id ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-600"
                            }`}
                          >
                            <span className="truncate">{cat.name}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {cat.ruleCount > 0 && <span className="text-[10px] text-slate-400">{cat.ruleCount}</span>}
                              <Badge variant="outline" className={`text-[10px] px-1 py-0 ${maturityColor(cat.maturity)}`}>
                                {cat.maturity[0]}
                              </Badge>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Rules view */}
        <div className="flex-1 min-w-0">
          {!selectedCategoryId ? (
            <div className="border rounded-lg bg-white flex items-center justify-center py-20">
              <div className="text-center">
                <Scale className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Select a category to view its compliance rules</p>
              </div>
            </div>
          ) : rulesLoading ? (
            <div className="border rounded-lg bg-white flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">{selectedCategoryName}</h2>
                <span className="text-sm text-slate-400">{filteredRules.length} of {rules.length} rules</span>
              </div>

              {/* Filter bar */}
              <div className="flex gap-2 flex-wrap">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {["ALLOWED", "RESTRICTED", "PROHIBITED", "UNKNOWN"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="LEGISLATION">Legislation</SelectItem>
                    <SelectItem value="PLATFORM_POLICY">Platform Policy</SelectItem>
                    <SelectItem value="PLATFORM_INDEPENDENT">Independent</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={maturityFilter} onValueChange={setMaturityFilter}>
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue placeholder="Maturity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {MATURITY_OPTIONS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {uniquePlatforms.length > 0 && (
                  <Select value={platformFilter} onValueChange={setPlatformFilter}>
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue placeholder="Platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Platforms</SelectItem>
                      <SelectItem value="none">No platform</SelectItem>
                      {uniquePlatforms.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {uniqueCountries.length > 0 && (
                  <Select value={countryFilter} onValueChange={setCountryFilter}>
                    <SelectTrigger className="w-28 h-8 text-xs">
                      <SelectValue placeholder="Country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="none">No country</SelectItem>
                      {uniqueCountries.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {(statusFilter !== "all" || sourceFilter !== "all" || maturityFilter !== "all" || platformFilter !== "all" || countryFilter !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => { setStatusFilter("all"); setSourceFilter("all"); setMaturityFilter("all"); setPlatformFilter("all"); setCountryFilter("all"); }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>

              {filteredRules.length === 0 ? (
                <div className="border rounded-lg bg-white py-12 text-center">
                  <p className="text-slate-400 text-sm">
                    {rules.length > 0 ? "No rules match the current filters." : "No compliance rules for this category yet."}
                  </p>
                </div>
              ) : (
                <>
                  {legislationRules.length > 0 && (
                    <RuleSection
                      title="Legislation Rules"
                      icon={<Scale className="h-4 w-4 text-indigo-500" />}
                      rules={legislationRules}
                      onSelect={setDetailRule}
                    />
                  )}
                  {platformRules.length > 0 && (
                    <RuleSection
                      title="Platform Policy Rules"
                      icon={<FileText className="h-4 w-4 text-teal-500" />}
                      rules={platformRules}
                      onSelect={setDetailRule}
                    />
                  )}
                  {independentRules.length > 0 && (
                    <RuleSection
                      title="Platform Independent Rules"
                      icon={<FileText className="h-4 w-4 text-slate-400" />}
                      rules={independentRules}
                      onSelect={setDetailRule}
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Rule Detail Sheet */}
      <Sheet open={!!detailRule} onOpenChange={(open) => { if (!open) setDetailRule(null); }}>
        <SheetContent className="w-[620px] sm:max-w-[620px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-base">{detailRule?.title}</SheetTitle>
          </SheetHeader>
          {detailRule && (
            <RuleDetail
              rule={detailRule}
              onUpdate={() => {
                if (selectedCategoryId) fetchRules(selectedCategoryId);
                setDetailRule(null);
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ─── Rule Section ─── */
function RuleSection({
  title,
  icon,
  rules,
  onSelect,
}: {
  title: string;
  icon: React.ReactNode;
  rules: ComplianceRule[];
  onSelect: (r: ComplianceRule) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <span className="text-xs text-slate-400">({rules.length})</span>
      </div>
      <div className="border rounded-lg bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rule</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Maturity</TableHead>
              <TableHead>Verified</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onSelect(rule)}>
                <TableCell className="max-w-[200px]">
                  <p className="text-sm font-medium truncate">{rule.title}</p>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {sourceIcon(rule.sourceType)}
                    <span className="text-xs text-slate-500 truncate max-w-[120px]">{sourceLabel(rule)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-slate-500">
                  <div className="flex gap-1 flex-wrap">
                    {rule.platform && <span className="bg-slate-100 px-1.5 py-0.5 rounded">{rule.platform.name}</span>}
                    {rule.country && <span className="bg-slate-100 px-1.5 py-0.5 rounded">{rule.country.code}</span>}
                    {!rule.platform && !rule.country && <span className="text-slate-400">All</span>}
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline" className={statusColor(rule.status)}>{rule.status}</Badge></TableCell>
                <TableCell><Badge variant="outline" className={maturityColor(rule.maturity)}>{rule.maturity}</Badge></TableCell>
                <TableCell className="text-xs text-slate-500">
                  {rule.lastVerifiedAt ? new Date(rule.lastVerifiedAt).toLocaleDateString() : "Never"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ─── Rule Detail ─── */
function RuleDetail({ rule, onUpdate }: { rule: ComplianceRule; onUpdate: () => void }) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // AI states
  const [chatMessage, setChatMessage] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatResponse, setChatResponse] = useState<string | null>(null);
  const [suggestedUpdate, setSuggestedUpdate] = useState<Record<string, unknown> | null>(null);

  const [findingSources, setFindingSources] = useState(false);
  const [sources, setSources] = useState<SuggestedSource[] | null>(null);
  const [sourcesResponse, setSourcesResponse] = useState<string | null>(null);

  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [assessmentResponse, setAssessmentResponse] = useState<string | null>(null);

  const patchRule = async (data: Record<string, unknown>) => {
    setSaving(true);
    await fetch(`/api/admin/compliance-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    onUpdate();
  };

  const handleDelete = async () => {
    setDeleting(true);
    await fetch(`/api/admin/compliance-rules/${rule.id}`, { method: "DELETE" });
    setDeleting(false);
    onUpdate();
  };

  const sendChat = async () => {
    if (!chatMessage.trim() || chatSending) return;
    setChatSending(true);
    setChatResponse(null);
    setSuggestedUpdate(null);
    const res = await fetch(`/api/admin/compliance-rules/${rule.id}/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "chat", message: chatMessage }),
    });
    const json = await res.json();
    if (json.success) {
      setChatResponse(json.response);
      if (json.suggestedUpdate) setSuggestedUpdate(json.suggestedUpdate);
    } else {
      setChatResponse(json.error?.message ?? "AI request failed");
    }
    setChatSending(false);
  };

  const applySuggestedUpdate = async (update: Record<string, unknown>) => {
    await patchRule(update);
  };

  const findSources = async () => {
    setFindingSources(true);
    setSources(null);
    setSourcesResponse(null);
    const res = await fetch(`/api/admin/compliance-rules/${rule.id}/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "find_sources" }),
    });
    const json = await res.json();
    if (json.success) {
      setSourcesResponse(json.response);
      if (json.sources) setSources(json.sources as SuggestedSource[]);
    } else {
      setSourcesResponse(json.error?.message ?? "Source search failed");
    }
    setFindingSources(false);
  };

  const checkUpdates = async () => {
    setCheckingUpdates(true);
    setAssessment(null);
    setAssessmentResponse(null);
    const res = await fetch(`/api/admin/compliance-rules/${rule.id}/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check_updates" }),
    });
    const json = await res.json();
    if (json.success) {
      setAssessmentResponse(json.response);
      if (json.assessment) setAssessment(json.assessment as Assessment);
    } else {
      setAssessmentResponse(json.error?.message ?? "Update check failed");
    }
    setCheckingUpdates(false);
  };

  return (
    <div className="space-y-5 mt-4">
      {/* Status + Maturity */}
      <div className="flex items-center gap-3">
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Status</label>
          <Select value={rule.status} onValueChange={(v) => patchRule({ status: v })}>
            <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["ALLOWED", "RESTRICTED", "PROHIBITED", "UNKNOWN"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Maturity</label>
          <Select value={rule.maturity} onValueChange={(v) => patchRule({ maturity: v })}>
            <SelectTrigger className="w-28 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MATURITY_OPTIONS.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={() => patchRule({ markVerified: true })} disabled={saving}>
            <CheckCircle className="h-3.5 w-3.5 mr-1" />Verify
          </Button>
        </div>
      </div>

      {/* Source */}
      <div className="bg-slate-50 rounded-lg p-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            {sourceIcon(rule.sourceType)}
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {rule.sourceType.replace(/_/g, " ")}
            </span>
          </div>
          {!rule.legislation && !rule.platformPolicy && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={findSources} disabled={findingSources}>
              {findingSources ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <SearchCheck className="h-3 w-3 mr-1" />}
              Find Sources
            </Button>
          )}
        </div>
        {rule.legislation && (
          <a href="/admin/legislation" target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
            {rule.legislation.title}<ExternalLink className="h-3 w-3" />
          </a>
        )}
        {rule.platformPolicy && (
          <a href="/admin/platform-policies" target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
            {rule.platformPolicy.title}<ExternalLink className="h-3 w-3" />
          </a>
        )}
        {!rule.legislation && !rule.platformPolicy && !sources && (
          <p className="text-sm text-slate-500">No linked source document</p>
        )}
      </div>

      {/* Sources results */}
      {sources && sources.length > 0 && (
        <div className="border rounded-lg p-3 bg-indigo-50/50">
          <p className="text-xs font-medium text-indigo-700 mb-2">Suggested Sources (draft -- review before linking)</p>
          {sourcesResponse && <p className="text-xs text-slate-600 mb-2">{sourcesResponse}</p>}
          <div className="space-y-2">
            {sources.map((src, i) => (
              <div key={i} className="bg-white border rounded p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{src.title}</p>
                    <div className="flex gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[10px]">{src.type.replace(/_/g, " ")}</Badge>
                      <Badge variant="outline" className={`text-[10px] ${
                        src.relevance === "HIGH" ? "bg-green-50 text-green-700" :
                        src.relevance === "MEDIUM" ? "bg-amber-50 text-amber-700" :
                        "bg-slate-50 text-slate-600"
                      }`}>{src.relevance}</Badge>
                      <span className="text-[10px] text-slate-400">{src.jurisdiction}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{src.summary}</p>
                    {src.keyProvisions && src.keyProvisions.length > 0 && (
                      <p className="text-xs text-slate-500 mt-0.5">Key provisions: {src.keyProvisions.join(", ")}</p>
                    )}
                  </div>
                  {src.sourceUrl && (
                    <a href={src.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 shrink-0">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scope */}
      <div>
        <label className="text-xs font-medium text-slate-500 block mb-1">Scope</label>
        <div className="flex gap-2 text-sm">
          <span className="text-slate-600">{rule.category.name}</span>
          {rule.platform && (<><span className="text-slate-400">/</span><span className="text-slate-600">{rule.platform.name}</span></>)}
          {rule.country && (<><span className="text-slate-400">/</span><span className="text-slate-600">{rule.country.name} ({rule.country.code})</span></>)}
        </div>
      </div>

      {/* Description */}
      {rule.description && (
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Description</label>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{rule.description}</p>
        </div>
      )}

      {/* Conditions */}
      {rule.conditions && Object.keys(rule.conditions).length > 0 && (
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Conditions</label>
          <pre className="text-xs bg-slate-50 rounded p-2 overflow-x-auto">
            {JSON.stringify(rule.conditions, null, 2)}
          </pre>
        </div>
      )}

      {/* AI Check Instructions */}
      {rule.aiCheckInstructions && (
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">AI Check Instructions</label>
          <p className="text-sm text-slate-700 whitespace-pre-wrap bg-amber-50 border border-amber-100 rounded p-2">
            {rule.aiCheckInstructions}
          </p>
        </div>
      )}

      {/* AI Actions */}
      <div className="border-t pt-4 space-y-3">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={checkUpdates} disabled={checkingUpdates} className="flex-1">
            {checkingUpdates ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            Check for Updates
          </Button>
          {!rule.legislation && !rule.platformPolicy && (
            <Button variant="outline" size="sm" onClick={findSources} disabled={findingSources} className="flex-1">
              {findingSources ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <SearchCheck className="h-3.5 w-3.5 mr-1.5" />}
              Find Sources
            </Button>
          )}
        </div>

        {/* Assessment results */}
        {assessment && (
          <div className="border rounded-lg p-3 bg-slate-50">
            <div className="flex items-center gap-2 mb-2">
              {assessment.needsUpdate ? (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              <span className="text-sm font-medium">
                {assessment.needsUpdate ? "Updates recommended" : "Rule appears current"}
              </span>
              <Badge variant="outline" className={`text-[10px] ${urgencyColor(assessment.urgency)}`}>
                {assessment.urgency}
              </Badge>
            </div>
            {assessmentResponse && <p className="text-xs text-slate-600 mb-2">{assessmentResponse}</p>}
            {assessment.findings.length > 0 && (
              <div className="space-y-2">
                {assessment.findings.map((f, i) => (
                  <div key={i} className="bg-white border rounded p-2">
                    <p className="text-xs font-medium text-slate-700">{f.area}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{f.issue}</p>
                    <p className="text-xs text-blue-600 mt-0.5">{f.recommendation}</p>
                  </div>
                ))}
              </div>
            )}
            {assessment.suggestedUpdate && (
              <div className="mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => applySuggestedUpdate(assessment.suggestedUpdate!)}
                  disabled={saving}
                >
                  <CheckCircle className="h-3 w-3 mr-1" />Apply Suggested Changes (Draft)
                </Button>
                <p className="text-[10px] text-slate-400 mt-1">Changes save as ALPHA maturity until you promote to LIVE</p>
              </div>
            )}
          </div>
        )}

        {/* AI Chat */}
        <div className="border rounded-lg p-3 bg-slate-50">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs font-medium text-slate-500">AI Rule Editor</span>
          </div>
          <p className="text-xs text-slate-400 mb-2">
            Describe changes in plain language, e.g. &quot;Add an age gate of 18+ and require a health disclaimer&quot;
          </p>
          <div className="flex gap-2">
            <Textarea
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder="What should this rule do?"
              rows={2}
              className="text-sm"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
            />
            <Button onClick={sendChat} disabled={chatSending || !chatMessage.trim()} size="icon" className="shrink-0 self-end">
              {chatSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>

          {chatResponse && (
            <div className="mt-3 bg-white border rounded p-2">
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{chatResponse}</p>
              {suggestedUpdate && (
                <div className="mt-2 pt-2 border-t">
                  <p className="text-xs font-medium text-slate-500 mb-1">Suggested changes:</p>
                  <pre className="text-xs bg-slate-50 rounded p-1.5 overflow-x-auto mb-2">
                    {JSON.stringify(suggestedUpdate, null, 2)}
                  </pre>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => applySuggestedUpdate(suggestedUpdate)}
                    disabled={saving}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />Apply Changes (Draft)
                  </Button>
                  <p className="text-[10px] text-slate-400 mt-1">Saves as ALPHA maturity until promoted to LIVE</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Verified */}
      <div className="text-xs text-slate-400">
        {rule.lastVerifiedAt
          ? `Last verified: ${new Date(rule.lastVerifiedAt).toLocaleString()}`
          : "Not yet verified"}
      </div>

      {/* Delete */}
      <div className="pt-3 border-t">
        {confirmDelete ? (
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Confirm Delete
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-3 w-3 mr-1" />Delete Rule
          </Button>
        )}
      </div>
    </div>
  );
}
