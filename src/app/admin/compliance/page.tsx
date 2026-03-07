"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Plus,
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

/* ─── Main Page ─── */
export default function CompliancePage() {
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [children, setChildren] = useState<Category[]>([]);
  const [rules, setRules] = useState<ComplianceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [rulesLoading, setRulesLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>("");

  const [detailRule, setDetailRule] = useState<ComplianceRule | null>(null);

  // Load category groups
  useEffect(() => {
    fetch("/api/admin/categories?groupView=true")
      .then((r) => r.json())
      .then((j) => { if (j.success) setGroups(j.data); })
      .finally(() => setLoading(false));
  }, []);

  // Load children when a group is selected
  useEffect(() => {
    if (!selectedGroupId) {
      setChildren([]);
      return;
    }
    fetch(`/api/admin/categories?parentId=${selectedGroupId}`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setChildren(j.data); });
  }, [selectedGroupId]);

  // Load rules when a category is selected
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

  const legislationRules = rules.filter((r) => r.sourceType === "LEGISLATION");
  const platformRules = rules.filter((r) => r.sourceType === "PLATFORM_POLICY");
  const independentRules = rules.filter((r) => r.sourceType === "PLATFORM_INDEPENDENT");

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

                    {/* Children */}
                    {selectedGroupId === group.id && children.length > 0 && (
                      <div className="bg-slate-50 border-t">
                        {children.map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => selectCategory(cat)}
                            className={`w-full text-left pl-7 pr-3 py-2 text-sm hover:bg-slate-100 transition-colors flex items-center justify-between ${
                              selectedCategoryId === cat.id
                                ? "bg-blue-50 text-blue-700 font-medium"
                                : "text-slate-600"
                            }`}
                          >
                            <span className="truncate">{cat.name}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {cat.ruleCount > 0 && (
                                <span className="text-[10px] text-slate-400">{cat.ruleCount}</span>
                              )}
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
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">{selectedCategoryName}</h2>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open("/admin/legislation", "_blank")}
                  >
                    <Scale className="h-3.5 w-3.5 mr-1.5" />Legislation
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open("/admin/platform-policies", "_blank")}
                  >
                    <FileText className="h-3.5 w-3.5 mr-1.5" />Policies
                  </Button>
                </div>
              </div>

              {rules.length === 0 ? (
                <div className="border rounded-lg bg-white py-12 text-center">
                  <p className="text-slate-400 text-sm">No compliance rules for this category yet.</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Add rules via the Legislation or Platform Policies pages.
                  </p>
                </div>
              ) : (
                <>
                  {/* Legislation Rules */}
                  {legislationRules.length > 0 && (
                    <RuleSection
                      title="Legislation Rules"
                      icon={<Scale className="h-4 w-4 text-indigo-500" />}
                      rules={legislationRules}
                      onSelect={setDetailRule}
                      onRefresh={() => fetchRules(selectedCategoryId!)}
                    />
                  )}

                  {/* Platform Policy Rules */}
                  {platformRules.length > 0 && (
                    <RuleSection
                      title="Platform Policy Rules"
                      icon={<FileText className="h-4 w-4 text-teal-500" />}
                      rules={platformRules}
                      onSelect={setDetailRule}
                      onRefresh={() => fetchRules(selectedCategoryId!)}
                    />
                  )}

                  {/* Platform Independent Rules */}
                  {independentRules.length > 0 && (
                    <RuleSection
                      title="Platform Independent Rules"
                      icon={<FileText className="h-4 w-4 text-slate-400" />}
                      rules={independentRules}
                      onSelect={setDetailRule}
                      onRefresh={() => fetchRules(selectedCategoryId!)}
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
        <SheetContent className="w-[560px] sm:max-w-[560px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{detailRule?.title}</SheetTitle>
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
  onRefresh,
}: {
  title: string;
  icon: React.ReactNode;
  rules: ComplianceRule[];
  onSelect: (r: ComplianceRule) => void;
  onRefresh: () => void;
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
              <TableRow
                key={rule.id}
                className="cursor-pointer hover:bg-slate-50"
                onClick={() => onSelect(rule)}
              >
                <TableCell className="max-w-[200px]">
                  <p className="text-sm font-medium truncate">{rule.title}</p>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {sourceIcon(rule.sourceType)}
                    <span className="text-xs text-slate-500 truncate max-w-[120px]">
                      {sourceLabel(rule)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-slate-500">
                  <div className="flex gap-1 flex-wrap">
                    {rule.platform && (
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded">{rule.platform.name}</span>
                    )}
                    {rule.country && (
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded">{rule.country.code}</span>
                    )}
                    {!rule.platform && !rule.country && (
                      <span className="text-slate-400">All</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusColor(rule.status)}>
                    {rule.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={maturityColor(rule.maturity)}>
                    {rule.maturity}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-slate-500">
                  {rule.lastVerifiedAt
                    ? new Date(rule.lastVerifiedAt).toLocaleDateString()
                    : "Never"}
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
function RuleDetail({
  rule,
  onUpdate,
}: {
  rule: ComplianceRule;
  onUpdate: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  return (
    <div className="space-y-5 mt-4">
      {/* Status + Maturity */}
      <div className="flex items-center gap-3">
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Status</label>
          <Select value={rule.status} onValueChange={(v) => patchRule({ status: v })}>
            <SelectTrigger className="w-32 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
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
            <SelectTrigger className="w-28 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MATURITY_OPTIONS.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => patchRule({ markVerified: true })}
            disabled={saving}
          >
            <CheckCircle className="h-3.5 w-3.5 mr-1" />Verify
          </Button>
        </div>
      </div>

      {/* Source */}
      <div className="bg-slate-50 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-1">
          {sourceIcon(rule.sourceType)}
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            {rule.sourceType.replace(/_/g, " ")}
          </span>
        </div>
        {rule.legislation && (
          <a
            href={`/admin/legislation`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
          >
            {rule.legislation.title}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {rule.platformPolicy && (
          <a
            href={`/admin/platform-policies`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
          >
            {rule.platformPolicy.title}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {!rule.legislation && !rule.platformPolicy && (
          <p className="text-sm text-slate-500">No linked source document</p>
        )}
      </div>

      {/* Scope */}
      <div>
        <label className="text-xs font-medium text-slate-500 block mb-1">Scope</label>
        <div className="flex gap-2 text-sm">
          <span className="text-slate-600">{rule.category.name}</span>
          {rule.platform && (
            <>
              <span className="text-slate-400">/</span>
              <span className="text-slate-600">{rule.platform.name}</span>
            </>
          )}
          {rule.country && (
            <>
              <span className="text-slate-400">/</span>
              <span className="text-slate-600">{rule.country.name} ({rule.country.code})</span>
            </>
          )}
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
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Confirm Delete
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-700"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-3 w-3 mr-1" />Delete Rule
          </Button>
        )}
      </div>
    </div>
  );
}
