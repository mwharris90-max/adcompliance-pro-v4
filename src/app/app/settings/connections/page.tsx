"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Loader2,
  Link2,
  Unlink,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Settings2,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";

interface ProviderInfo {
  provider: string;
  displayName: string;
  icon: string;
  supportsAutoSync: boolean;
  configured: boolean;
}

interface IntegrationInfo {
  id: string;
  provider: string;
  status: string;
  label: string | null;
  externalAccountId: string | null;
  externalAccountName: string | null;
  autoSyncEnabled: boolean;
  syncIntervalMins: number;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncAdCount: number | null;
  errorCount: number;
  lastErrorMessage: string | null;
  createdAt: string;
  connectedBy: { name: string };
}

export default function ConnectionsPage() {
  const searchParams = useSearchParams();
  const successMsg = searchParams.get("success");
  const errorMsg = searchParams.get("error");

  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<IntegrationInfo | null>(null);

  function fetchData() {
    fetch("/api/integrations")
      .then((r) => r.json())
      .then((data) => {
        setProviders(data.providers ?? []);
        setIntegrations(data.integrations ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function handleConnect(provider: string) {
    setConnecting(provider);
    try {
      const res = await fetch(`/api/integrations/${provider.toLowerCase()}/connect`);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setConnecting(null);
    }
  }

  async function handleDisconnect(integration: IntegrationInfo) {
    await fetch(
      `/api/integrations/${integration.provider.toLowerCase()}/${integration.id}`,
      { method: "DELETE" }
    );
    setDisconnectTarget(null);
    fetchData();
  }

  async function handleSync(integration: IntegrationInfo) {
    setSyncing(integration.id);
    try {
      await fetch(
        `/api/integrations/${integration.provider.toLowerCase()}/${integration.id}/sync`,
        { method: "POST" }
      );
      fetchData();
    } finally {
      setSyncing(null);
    }
  }

  async function handleToggleAutoSync(integration: IntegrationInfo, enabled: boolean) {
    await fetch(
      `/api/integrations/${integration.provider.toLowerCase()}/${integration.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoSyncEnabled: enabled }),
      }
    );
    setIntegrations((prev) =>
      prev.map((i) => (i.id === integration.id ? { ...i, autoSyncEnabled: enabled } : i))
    );
  }

  async function handleSyncInterval(integration: IntegrationInfo, mins: number) {
    await fetch(
      `/api/integrations/${integration.provider.toLowerCase()}/${integration.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncIntervalMins: mins }),
      }
    );
    setIntegrations((prev) =>
      prev.map((i) => (i.id === integration.id ? { ...i, syncIntervalMins: mins } : i))
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  // Group integrations by provider
  const connectedProviders = new Set(
    integrations.filter((i) => i.status === "CONNECTED").map((i) => i.provider)
  );

  return (
    <div className="max-w-3xl space-y-8">
      <div className="border-l-[3px] border-[#1A56DB] pl-3">
        <h1 className="text-xl font-semibold text-slate-900">Connections</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Connect your ad platform accounts to automatically check compliance on your ads.
        </p>
      </div>

      {successMsg && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">{successMsg}</AlertDescription>
        </Alert>
      )}
      {errorMsg && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* Available providers */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Ad Platforms</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {providers.map((provider) => {
            const connected = connectedProviders.has(provider.provider);
            const integration = integrations.find(
              (i) => i.provider === provider.provider && i.status === "CONNECTED"
            );

            return (
              <Card
                key={provider.provider}
                className={cn(
                  "border-slate-200 shadow-sm",
                  connected && "border-green-200 bg-green-50/30"
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={provider.icon}
                        alt={provider.displayName}
                        className="h-8 w-8"
                      />
                      <div>
                        <CardTitle className="text-base">{provider.displayName}</CardTitle>
                        {integration && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {integration.externalAccountName}
                          </p>
                        )}
                      </div>
                    </div>
                    {connected ? (
                      <Badge className="bg-green-100 text-green-700 border-green-200 gap-1 hover:bg-green-100">
                        <CheckCircle className="h-3 w-3" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-slate-500">
                        Not connected
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {connected && integration ? (
                    <div className="space-y-4">
                      {/* Sync status */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Clock className="h-3.5 w-3.5" />
                          {integration.lastSyncAt ? (
                            <span>
                              Last sync:{" "}
                              {new Date(integration.lastSyncAt).toLocaleString("en-GB", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              {integration.lastSyncAdCount !== null && (
                                <span className="text-slate-400">
                                  {" "}({integration.lastSyncAdCount} ads)
                                </span>
                              )}
                            </span>
                          ) : (
                            <span>Never synced</span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSync(integration)}
                          disabled={syncing === integration.id}
                          className="h-7 text-xs"
                        >
                          {syncing === integration.id ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <RefreshCw className="h-3 w-3 mr-1" />
                          )}
                          Sync Now
                        </Button>
                      </div>

                      {/* Error display */}
                      {integration.lastErrorMessage && (
                        <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded p-2">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          {integration.lastErrorMessage}
                        </div>
                      )}

                      {/* Auto-sync settings */}
                      {provider.supportsAutoSync && (
                        <div className="space-y-3 pt-2 border-t border-slate-100">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Settings2 className="h-3.5 w-3.5 text-slate-400" />
                              <Label className="text-sm">Auto-sync</Label>
                            </div>
                            <Switch
                              checked={integration.autoSyncEnabled}
                              onCheckedChange={(v) => handleToggleAutoSync(integration, v)}
                            />
                          </div>

                          {integration.autoSyncEnabled && (
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-slate-500 shrink-0">
                                Check every
                              </Label>
                              <Select
                                value={String(integration.syncIntervalMins)}
                                onValueChange={(v) =>
                                  handleSyncInterval(integration, parseInt(v))
                                }
                              >
                                <SelectTrigger className="h-7 w-28 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="15">15 mins</SelectItem>
                                  <SelectItem value="30">30 mins</SelectItem>
                                  <SelectItem value="60">1 hour</SelectItem>
                                  <SelectItem value="360">6 hours</SelectItem>
                                  <SelectItem value="720">12 hours</SelectItem>
                                  <SelectItem value="1440">24 hours</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Disconnect */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 h-7 text-xs w-full"
                        onClick={() => setDisconnectTarget(integration)}
                      >
                        <Unlink className="h-3 w-3 mr-1" />
                        Disconnect
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-500">
                        Connect your {provider.displayName} account to automatically pull ads
                        for compliance checking.
                      </p>
                      <Button
                        onClick={() => handleConnect(provider.provider)}
                        disabled={!provider.configured || connecting !== null}
                        className="w-full"
                      >
                        {connecting === provider.provider ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Link2 className="h-4 w-4 mr-2" />
                        )}
                        {!provider.configured
                          ? "Coming Soon"
                          : connecting === provider.provider
                          ? "Redirecting..."
                          : `Connect ${provider.displayName}`}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Connected integrations detail */}
      {integrations.filter((i) => i.status === "CONNECTED").length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">
            <Zap className="inline h-4 w-4 text-violet-500 mr-1.5 -mt-0.5" />
            Active Connections
          </h2>
          <p className="text-sm text-slate-500">
            Connected accounts will appear in your compliance dashboard. Enable auto-sync to
            automatically check new ads as they&apos;re created.
          </p>
        </div>
      )}

      {/* Disconnect confirm */}
      <AlertDialog
        open={!!disconnectTarget}
        onOpenChange={(o) => !o && setDisconnectTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Disconnect {disconnectTarget?.label ?? disconnectTarget?.externalAccountName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will revoke access to the ad account. Auto-sync will stop and no new ads
              will be pulled. You can reconnect at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => disconnectTarget && handleDisconnect(disconnectTarget)}
              className="bg-red-600 hover:bg-red-700"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
