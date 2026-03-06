"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { format } from "date-fns";
import { ExternalLink, CheckCircle2, XCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

type ChangeStatus = "PENDING" | "CONFIRMED" | "REJECTED";
type ChangeType = "NEW_RULE" | "AMENDED_RULE" | "REMOVED_RULE";
type RuleType = "PLATFORM_RULE" | "GEO_RULE" | "CHANNEL_REQUIREMENT";

interface ProposedChange {
  id: string;
  changeType: ChangeType;
  ruleType: RuleType;
  status: ChangeStatus;
  aiSummary: string;
  sourceUrl: string;
  proposedData: Record<string, unknown>;
  currentRuleData: Record<string, unknown> | null;
  currentRuleId: string | null;
  platformId: string | null;
  detectedAt: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
  category: { id: string; name: string } | null;
  country: { id: string; name: string; code: string } | null;
  reviewedBy: { id: string; name: string } | null;
}

interface RuleSnapshot {
  status?: string;
  notes?: string;
  conditions?: Record<string, unknown>;
  restrictions?: Record<string, unknown>;
  referenceUrl?: string;
  legislationUrl?: string;
}

const STATUS_CONFIG: Record<ChangeStatus, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING: { label: "Pending", color: "bg-amber-100 text-amber-800 border-amber-200", icon: <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> },
  CONFIRMED: { label: "Confirmed", color: "bg-green-100 text-green-800 border-green-200", icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-800 border-red-200", icon: <XCircle className="h-3.5 w-3.5 text-red-500" /> },
};

const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  NEW_RULE: "New Rule",
  AMENDED_RULE: "Amended Rule",
  REMOVED_RULE: "Removed Rule",
};

const RULE_TYPE_LABELS: Record<RuleType, string> = {
  PLATFORM_RULE: "Platform Rule",
  GEO_RULE: "Geographic Rule",
  CHANNEL_REQUIREMENT: "Channel Requirement",
};

function RuleDataDisplay({ data, label }: { data: RuleSnapshot | null | undefined; label: string }) {
  if (!data) return <p className="text-sm text-slate-400 italic">No data</p>;
  return (
    <div className="space-y-1.5 text-sm">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      {data.status && (
        <p><span className="text-slate-500">Status:</span> <strong>{data.status}</strong></p>
      )}
      {data.notes && (
        <p><span className="text-slate-500">Notes:</span> {data.notes}</p>
      )}
      {data.conditions && Object.keys(data.conditions).length > 0 && (
        <p><span className="text-slate-500">Conditions:</span> <code className="text-xs bg-slate-100 px-1 rounded">{JSON.stringify(data.conditions)}</code></p>
      )}
      {data.restrictions && Object.keys(data.restrictions).length > 0 && (
        <p><span className="text-slate-500">Restrictions:</span> <code className="text-xs bg-slate-100 px-1 rounded">{JSON.stringify(data.restrictions)}</code></p>
      )}
      {(data.referenceUrl || data.legislationUrl) && (
        <p>
          <span className="text-slate-500">Reference:</span>{" "}
          <a href={data.referenceUrl ?? data.legislationUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs">
            {data.referenceUrl ?? data.legislationUrl}
          </a>
        </p>
      )}
    </div>
  );
}

export default function ProposedChangesPage() {
  const [changes, setChanges] = useState<ProposedChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [selectedChange, setSelectedChange] = useState<ProposedChange | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchChanges = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/proposed-changes?status=${statusFilter}`)
      .then((r) => r.json())
      .then((json) => { if (json.success) setChanges(json.data); })
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { fetchChanges(); }, [fetchChanges]);

  function openDetail(change: ProposedChange) {
    setSelectedChange(change);
    setError(null);
  }

  function handleConfirm(overrideData?: Record<string, unknown>) {
    if (!selectedChange) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/proposed-changes/${selectedChange.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", ...(overrideData ? { overrideData } : {}) }),
      });
      const json = await res.json();
      if (json.success) {
        setSelectedChange(null);
        fetchChanges();
      } else {
        setError(json.error?.message ?? "Something went wrong");
      }
    });
  }

  function openReject() {
    setRejectNotes("");
    setRejectOpen(true);
  }

  function handleReject() {
    if (!selectedChange) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/proposed-changes/${selectedChange.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reviewNotes: rejectNotes || undefined }),
      });
      const json = await res.json();
      if (json.success) {
        setRejectOpen(false);
        setSelectedChange(null);
        fetchChanges();
      } else {
        setError(json.error?.message ?? "Something went wrong");
      }
    });
  }

  const affectedLabel = (c: ProposedChange) => {
    const parts: string[] = [];
    if (c.country) parts.push(`${c.country.code} ${c.country.name}`);
    if (c.category) parts.push(c.category.name);
    return parts.join(" × ") || "—";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Proposed Changes</h1>
        <p className="text-slate-500 mt-1">Review AI-detected rule changes. Confirm to apply or reject to dismiss.</p>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="CONFIRMED">Confirmed</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="ALL">All</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-slate-500">{changes.length} record{changes.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      <div className="rounded-md border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Affected</TableHead>
              <TableHead>Detected</TableHead>
              <TableHead>AI Summary</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline-block text-slate-400" />
                </TableCell>
              </TableRow>
            ) : changes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                  {statusFilter === "PENDING" ? "No pending changes — all clear." : "No changes found."}
                </TableCell>
              </TableRow>
            ) : (
              changes.map((change) => (
                <TableRow
                  key={change.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => openDetail(change)}
                >
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium">{CHANGE_TYPE_LABELS[change.changeType]}</p>
                      <p className="text-xs text-slate-400">{RULE_TYPE_LABELS[change.ruleType]}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{affectedLabel(change)}</TableCell>
                  <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                    {format(new Date(change.detectedAt), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="text-sm text-slate-700 line-clamp-2">{change.aiSummary}</p>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_CONFIG[change.status].color}`}>
                      {STATUS_CONFIG[change.status].icon}
                      {STATUS_CONFIG[change.status].label}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedChange} onOpenChange={(o) => !o && setSelectedChange(null)}>
        {selectedChange && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_CONFIG[selectedChange.status].color}`}>
                  {STATUS_CONFIG[selectedChange.status].label}
                </span>
                <DialogTitle className="text-base">
                  {CHANGE_TYPE_LABELS[selectedChange.changeType]} — {RULE_TYPE_LABELS[selectedChange.ruleType]}
                </DialogTitle>
              </div>
            </DialogHeader>

            <div className="space-y-5 mt-2">
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

              {/* Meta */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Detected</p>
                  <p>{format(new Date(selectedChange.detectedAt), "dd MMM yyyy, HH:mm")}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Affected</p>
                  <p>{affectedLabel(selectedChange)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-slate-500 mb-0.5">Source</p>
                  <a
                    href={selectedChange.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline flex items-center gap-1 text-sm"
                  >
                    {selectedChange.sourceUrl}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              <Separator />

              {/* AI Summary */}
              <div className="bg-slate-50 rounded-md p-4 border border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">AI Summary</p>
                <p className="text-sm text-slate-700">{selectedChange.aiSummary}</p>
              </div>

              {/* Side-by-side rule comparison */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-md p-4 border border-slate-200">
                  <RuleDataDisplay
                    data={selectedChange.currentRuleData as RuleSnapshot}
                    label="Current Rule"
                  />
                </div>
                <div className="bg-blue-50 rounded-md p-4 border border-blue-200">
                  <RuleDataDisplay
                    data={selectedChange.proposedData as RuleSnapshot}
                    label="Proposed Rule"
                  />
                </div>
              </div>

              {/* Review info if already reviewed */}
              {selectedChange.status !== "PENDING" && (
                <div className="text-sm text-slate-500 space-y-0.5">
                  {selectedChange.reviewedBy && (
                    <p>Reviewed by {selectedChange.reviewedBy.name} on {selectedChange.reviewedAt ? format(new Date(selectedChange.reviewedAt), "dd MMM yyyy") : "—"}</p>
                  )}
                  {selectedChange.reviewNotes && (
                    <p className="italic">&quot;{selectedChange.reviewNotes}&quot;</p>
                  )}
                </div>
              )}
            </div>

            {selectedChange.status === "PENDING" && (
              <DialogFooter className="flex gap-2 mt-4">
                <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 mr-auto" onClick={openReject}>
                  Reject
                </Button>
                <Button variant="outline" onClick={() => handleConfirm(selectedChange.proposedData as Record<string, unknown>)} disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm Change
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        )}
      </Dialog>

      {/* Reject confirmation dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject this change?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Reason <span className="text-slate-400 font-normal">(optional)</span></Label>
              <Textarea
                rows={3}
                placeholder="Why are you rejecting this change?"
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
