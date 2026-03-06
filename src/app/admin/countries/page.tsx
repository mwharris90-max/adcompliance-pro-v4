"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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

const REGIONS = [
  { value: "NORTH_AMERICA", label: "North America" },
  { value: "LATIN_AMERICA", label: "Latin America" },
  { value: "EUROPEAN_UNION", label: "European Union" },
  { value: "EUROPE_OTHER", label: "Europe (Other)" },
  { value: "UNITED_KINGDOM", label: "United Kingdom" },
  { value: "MIDDLE_EAST_AFRICA", label: "Middle East & Africa" },
  { value: "ASIA_PACIFIC", label: "Asia Pacific" },
  { value: "OCEANIA", label: "Oceania" },
  { value: "SOUTH_ASIA", label: "South Asia" },
];

function regionLabel(region: string) {
  return REGIONS.find((r) => r.value === region)?.label ?? region;
}

interface Country {
  id: string;
  name: string;
  code: string;
  region: string;
  approved: boolean;
  approvedAt: string | null;
  complexRules: boolean;
  _count: { geoRules: number };
}

type ApproveAction = { country: Country; newValue: boolean };

export default function CountriesPage() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("all");
  const [approvedFilter, setApprovedFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<ApproveAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCountries = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (region !== "all") params.set("region", region);
    if (approvedFilter !== "all") params.set("approved", approvedFilter);
    fetch(`/api/admin/countries?${params}`)
      .then((r) => r.json())
      .then((json) => { if (json.success) setCountries(json.data); })
      .finally(() => setLoading(false));
  }, [search, region, approvedFilter]);

  useEffect(() => {
    const t = setTimeout(fetchCountries, 300);
    return () => clearTimeout(t);
  }, [fetchCountries]);

  async function handleApproveConfirm() {
    if (!pendingAction) return;
    const { country, newValue } = pendingAction;
    setPendingAction(null);

    setCountries((prev) =>
      prev.map((c) => c.id === country.id ? { ...c, approved: newValue } : c)
    );

    const res = await fetch(`/api/admin/countries/${country.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: newValue }),
    });
    const json = await res.json();
    if (!json.success) {
      setError(json.error?.message ?? "Update failed");
      fetchCountries();
    }
  }

  async function toggleComplexRules(country: Country) {
    setCountries((prev) =>
      prev.map((c) => c.id === country.id ? { ...c, complexRules: !c.complexRules } : c)
    );
    const res = await fetch(`/api/admin/countries/${country.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complexRules: !country.complexRules }),
    });
    const json = await res.json();
    if (!json.success) fetchCountries();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Countries</h1>
        <p className="text-slate-500 mt-1">Approve countries to make them available for compliance checks.</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search countries..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All regions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>
            {REGIONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={approvedFilter} onValueChange={setApprovedFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="true">Approved</SelectItem>
            <SelectItem value="false">Not Approved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Country</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Region</TableHead>
              <TableHead className="text-center">Geo Rules</TableHead>
              <TableHead className="text-center">Complex Rules</TableHead>
              <TableHead className="text-center">Approved</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline-block text-slate-400" />
                </TableCell>
              </TableRow>
            ) : countries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400">No countries found.</TableCell>
              </TableRow>
            ) : (
              countries.map((country) => (
                <TableRow key={country.id}>
                  <TableCell className="font-medium">{country.name}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">{country.code}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{regionLabel(country.region)}</Badge>
                  </TableCell>
                  <TableCell className="text-center text-sm text-slate-500">
                    {country._count.geoRules}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={country.complexRules}
                      onCheckedChange={() => toggleComplexRules(country)}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={country.approved}
                      onCheckedChange={(v) => setPendingAction({ country, newValue: v })}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Approve/Unapprove confirm dialog */}
      <AlertDialog open={!!pendingAction} onOpenChange={(o) => !o && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.newValue ? "Approve" : "Unapprove"} {pendingAction?.country.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.newValue
                ? `This will make ${pendingAction.country.name} available for selection in compliance checks.`
                : `Unapproving will hide ${pendingAction?.country.name} from users. Existing checks won't be affected.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApproveConfirm}>
              {pendingAction?.newValue ? "Approve" : "Unapprove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
