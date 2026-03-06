"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import {
  Loader2,
  Gift,
  RotateCcw,
  Zap,
  ArrowDownCircle,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Org {
  id: string;
  name: string;
  creditBalance: number;
  monthlyLimit: number | null;
  users: OrgUser[];
}

interface RecentTx {
  id: string;
  type: string;
  credits: number;
  packName: string | null;
  createdAt: string;
  user: { name: string; email: string };
  organisation: { name: string } | null;
}

export default function CreditsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [transactions, setTransactions] = useState<RecentTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"GRANT" | "REFUND">("GRANT");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [credits, setCredits] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/credits")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setOrgs(json.data.orgs);
          setTransactions(json.data.recentTransactions);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Flatten all users for the select
  const allUsers = orgs.flatMap((org) =>
    org.users.map((u) => ({ ...u, orgName: org.name, orgId: org.id }))
  );

  function openDialog(type: "GRANT" | "REFUND") {
    setDialogType(type);
    setSelectedUserId("");
    setCredits("");
    setReason("");
    setError(null);
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!selectedUserId || !credits || !reason) {
      setError("All fields are required.");
      return;
    }
    const numCredits = parseInt(credits);
    if (isNaN(numCredits) || numCredits <= 0) {
      setError("Credits must be a positive number.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          type: dialogType,
          credits: numCredits,
          reason,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setDialogOpen(false);
        const user = allUsers.find((u) => u.id === selectedUserId);
        setSuccess(
          `${dialogType === "GRANT" ? "Granted" : "Refunded"} ${numCredits} Checkdits to ${user?.name ?? "user"}.`
        );
        setTimeout(() => setSuccess(null), 5000);
        fetchData();
      } else {
        setError(json.error?.message ?? "Something went wrong.");
      }
    } catch {
      setError("Request failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Credit Management</h1>
          <p className="text-slate-500 mt-1">
            Grant or refund Checkdit credits to users and organisations.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => openDialog("GRANT")} className="bg-green-600 hover:bg-green-700">
            <Gift className="h-4 w-4 mr-2" />
            Grant Credits
          </Button>
          <Button onClick={() => openDialog("REFUND")} variant="outline">
            <RotateCcw className="h-4 w-4 mr-2" />
            Refund Credits
          </Button>
        </div>
      </div>

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <AlertDescription className="text-green-700">{success}</AlertDescription>
        </Alert>
      )}

      {/* Org balances */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Organisation Balances</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {orgs.map((org) => (
            <Card key={org.id} className="border-slate-200 shadow-sm">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-slate-400" />
                    <p className="font-medium text-sm text-slate-900">{org.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-semibold text-slate-900 tabular-nums">
                      {org.creditBalance}
                    </p>
                    <p className="text-xs text-slate-400">Checkdits</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {org.users.map((u) => (
                    <span
                      key={u.id}
                      className={cn(
                        "text-xs px-1.5 py-0.5 rounded border",
                        u.role === "ADMIN"
                          ? "bg-purple-50 text-purple-700 border-purple-200"
                          : "bg-slate-50 text-slate-600 border-slate-200"
                      )}
                    >
                      {u.name}
                    </span>
                  ))}
                </div>
                {org.monthlyLimit !== null && (
                  <p className="text-xs text-slate-400 mt-2">
                    Monthly limit: {org.monthlyLimit}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
          {orgs.length === 0 && (
            <p className="text-sm text-slate-400 col-span-3">No organisations found.</p>
          )}
        </div>
      </div>

      {/* Recent admin adjustments */}
      {transactions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Recent Grants & Refunds</h2>
          <div className="rounded-md border border-slate-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      <Badge
                        className={cn(
                          "gap-1",
                          tx.type === "GRANT"
                            ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-100"
                            : "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100"
                        )}
                      >
                        {tx.type === "GRANT" ? (
                          <Gift className="h-3 w-3" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        {tx.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{tx.user.name}</TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {tx.organisation?.name ?? "-"}
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-green-600 tabular-nums flex items-center gap-1">
                        <ArrowDownCircle className="h-3.5 w-3.5" />
                        +{tx.credits}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 max-w-xs truncate">
                      {tx.packName}
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">
                      {format(new Date(tx.createdAt), "dd MMM yyyy, HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Grant/Refund dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dialogType === "GRANT" ? (
                <>
                  <Gift className="h-5 w-5 text-green-600" />
                  Grant Credits
                </>
              ) : (
                <>
                  <RotateCcw className="h-5 w-5 text-blue-600" />
                  Refund Credits
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label>User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user..." />
                </SelectTrigger>
                <SelectContent>
                  {allUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.orgName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400">
                Credits are added to the user&apos;s organisation balance.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>
                <Zap className="inline h-3.5 w-3.5 text-violet-500 mr-1" />
                Checkdits
              </Label>
              <Input
                type="number"
                min="1"
                placeholder="e.g. 50"
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Textarea
                placeholder={
                  dialogType === "GRANT"
                    ? "e.g. Beta tester bonus, trial extension..."
                    : "e.g. Failed check refund, billing issue..."
                }
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className={
                dialogType === "GRANT"
                  ? "bg-green-600 hover:bg-green-700"
                  : ""
              }
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {dialogType === "GRANT" ? "Grant Credits" : "Issue Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
