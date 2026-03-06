"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  Link2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SyncedAd {
  id: string;
  externalAdId: string;
  externalStatus: string | null;
  adContent: Record<string, unknown>;
  assetUrls: string[];
  lastSyncedAt: string;
  createdAt: string;
  complianceCheckId: string | null;
  complianceCheck: {
    id: string;
    overallStatus: string | null;
    completedAt: string | null;
  } | null;
  integration: {
    id: string;
    provider: string;
    label: string | null;
    externalAccountName: string | null;
  };
}

const providerLabels: Record<string, string> = {
  META: "Meta Ads",
  GOOGLE_ADS: "Google Ads",
  HUBSPOT: "HubSpot",
  HOOTSUITE: "Hootsuite",
};

const providerIcons: Record<string, string> = {
  META: "/logos/facebook.svg",
  GOOGLE_ADS: "/logos/google-ads.svg",
};

function StatusBadge({ status }: { status: string | null }) {
  if (status === "CLEAN")
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 gap-1 hover:bg-green-100">
        <ShieldCheck className="h-3 w-3" /> Clean
      </Badge>
    );
  if (status === "WARNINGS")
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1 hover:bg-amber-100">
        <AlertTriangle className="h-3 w-3" /> Warnings
      </Badge>
    );
  if (status === "VIOLATIONS")
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 gap-1 hover:bg-red-100">
        <XCircle className="h-3 w-3" /> Violations
      </Badge>
    );
  if (status === "RUNNING")
    return (
      <Badge className="bg-blue-100 text-blue-700 border-blue-200 gap-1 hover:bg-blue-100">
        <Loader2 className="h-3 w-3 animate-spin" /> Checking
      </Badge>
    );
  return (
    <Badge variant="secondary" className="text-slate-500 gap-1">
      <Clock className="h-3 w-3" /> Pending
    </Badge>
  );
}

export default function IntegrationsPage() {
  const [ads, setAds] = useState<SyncedAd[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/integrations/synced-ads")
      .then((r) => r.json())
      .then((data) => setAds(data.ads ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  // Group by integration
  const byIntegration = ads.reduce<Record<string, SyncedAd[]>>((acc, ad) => {
    const key = ad.integration.id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(ad);
    return acc;
  }, {});

  const hasAds = ads.length > 0;

  // Summary stats
  const totalAds = ads.length;
  const clean = ads.filter((a) => a.complianceCheck?.overallStatus === "CLEAN").length;
  const warnings = ads.filter((a) => a.complianceCheck?.overallStatus === "WARNINGS").length;
  const violations = ads.filter((a) => a.complianceCheck?.overallStatus === "VIOLATIONS").length;
  const pending = ads.filter((a) => !a.complianceCheck).length;

  return (
    <div className="space-y-8">
      <div className="border-l-[3px] border-[#1A56DB] pl-3">
        <h1 className="text-xl font-semibold text-slate-900">Integrated Ads</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Ads synced from your connected ad platform accounts.
        </p>
      </div>

      {!hasAds ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center">
            <Link2 className="h-10 w-10 text-slate-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-900 mb-1">No synced ads yet</h2>
            <p className="text-sm text-slate-500 mb-4">
              Connect your Meta or Google Ads account to start pulling ads automatically.
            </p>
            <Link href="/app/settings/connections">
              <Button>
                <Link2 className="h-4 w-4 mr-2" />
                Connect an Account
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <Card className="border-slate-200 shadow-sm border-l-[3px] border-l-[#1A56DB]">
              <CardContent className="pt-4 pb-4">
                <p className="text-2xl font-semibold text-slate-900 tabular-nums">{totalAds}</p>
                <p className="text-xs text-slate-500 mt-0.5">Total Ads</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm border-l-[3px] border-l-green-500">
              <CardContent className="pt-4 pb-4">
                <p className="text-2xl font-semibold text-green-600 tabular-nums">{clean}</p>
                <p className="text-xs text-slate-500 mt-0.5">Clean</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm border-l-[3px] border-l-amber-500">
              <CardContent className="pt-4 pb-4">
                <p className="text-2xl font-semibold text-amber-600 tabular-nums">{warnings}</p>
                <p className="text-xs text-slate-500 mt-0.5">Warnings</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm border-l-[3px] border-l-red-500">
              <CardContent className="pt-4 pb-4">
                <p className="text-2xl font-semibold text-red-600 tabular-nums">{violations}</p>
                <p className="text-xs text-slate-500 mt-0.5">Violations</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm border-l-[3px] border-l-slate-300">
              <CardContent className="pt-4 pb-4">
                <p className="text-2xl font-semibold text-slate-400 tabular-nums">{pending}</p>
                <p className="text-xs text-slate-500 mt-0.5">Pending</p>
              </CardContent>
            </Card>
          </div>

          {/* Ads grouped by integration */}
          {Object.entries(byIntegration).map(([integrationId, integrationAds]) => {
            const integration = integrationAds[0].integration;
            return (
              <div key={integrationId} className="space-y-3">
                <div className="flex items-center gap-2">
                  {providerIcons[integration.provider] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={providerIcons[integration.provider]}
                      alt=""
                      className="h-5 w-5"
                    />
                  )}
                  <h2 className="text-base font-semibold text-slate-900">
                    {integration.label ?? providerLabels[integration.provider] ?? integration.provider}
                  </h2>
                  <span className="text-xs text-slate-400">
                    ({integrationAds.length} ads)
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                  <div className="divide-y divide-slate-100">
                    {integrationAds.map((ad) => {
                      const content = ad.adContent as Record<string, string>;
                      const headline = content.headline ?? content.title ?? "";
                      const body = content.body ?? content.primaryText ?? "";
                      const status = ad.complianceCheck?.overallStatus ?? null;

                      return (
                        <div
                          key={ad.id}
                          className={cn(
                            "flex items-center gap-4 px-5 py-4",
                            ad.complianceCheck
                              ? "hover:bg-slate-50 transition-colors"
                              : "opacity-70"
                          )}
                        >
                          <StatusBadge status={status} />

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {headline || "(No headline)"}
                            </p>
                            {body && (
                              <p className="text-xs text-slate-500 mt-0.5 truncate">
                                {body}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-slate-400">
                              {new Date(ad.lastSyncedAt).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {ad.complianceCheck && (
                              <Link href={`/app/check/results/${ad.complianceCheck.id}`}>
                                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                                  <ExternalLink className="h-3 w-3" />
                                  View
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
