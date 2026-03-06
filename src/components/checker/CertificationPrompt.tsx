"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  AlertTriangle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface RequiredCertification {
  id: string;
  slug: string;
  name: string;
  platform: { id: string; name: string; slug: string };
  description: string;
  infoUrl: string | null;
  affectedCategories: string[];
  held: boolean;
}

interface CertificationPromptProps {
  platformIds: string[];
  categoryIds: string[];
  /** Called whenever certification state changes — parent uses this for check logic */
  onCertificationsResolved: (
    required: RequiredCertification[],
    allConfirmed: boolean
  ) => void;
}

export function CertificationPrompt({
  platformIds,
  categoryIds,
  onCertificationsResolved,
}: CertificationPromptProps) {
  const [loading, setLoading] = useState(false);
  const [required, setRequired] = useState<RequiredCertification[]>([]);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [acknowledgedWithout, setAcknowledgedWithout] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);

  // Fetch required certifications when platforms/categories change
  useEffect(() => {
    if (!platformIds.length || !categoryIds.length) {
      setRequired([]);
      onCertificationsResolved([], true);
      return;
    }

    setLoading(true);
    fetch("/api/certifications/required", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platformIds, categoryIds }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          const reqs = data.data.required as RequiredCertification[];
          setRequired(reqs);
          const heldSet = new Set(
            reqs.filter((r) => r.held).map((r) => r.id)
          );
          setConfirmed(heldSet);
          onCertificationsResolved(
            reqs,
            reqs.every((r) => r.held)
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformIds.join(","), categoryIds.join(",")]);

  const handleConfirm = useCallback(
    async (certId: string) => {
      setSaving(certId);
      try {
        const res = await fetch("/api/user/certifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ certificationId: certId }),
        });
        if (res.ok) {
          const next = new Set(confirmed);
          next.add(certId);
          setConfirmed(next);
          const updatedRequired = required.map((r) =>
            r.id === certId ? { ...r, held: true } : r
          );
          setRequired(updatedRequired);
          onCertificationsResolved(
            updatedRequired,
            updatedRequired.every((r) => r.held || next.has(r.id))
          );
        }
      } catch {
        // ignore
      } finally {
        setSaving(null);
      }
    },
    [confirmed, required, onCertificationsResolved]
  );

  const handleAcknowledgeWithout = useCallback(
    (certId: string) => {
      const next = new Set(acknowledgedWithout);
      next.add(certId);
      setAcknowledgedWithout(next);
    },
    [acknowledgedWithout]
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking certification requirements...
      </div>
    );
  }

  if (!required.length) return null;

  const allResolved = required.every(
    (r) => confirmed.has(r.id) || acknowledgedWithout.has(r.id)
  );
  const unresolved = required.filter(
    (r) => !confirmed.has(r.id) && !acknowledgedWithout.has(r.id)
  );
  const hasUnconfirmed = required.some(
    (r) => !confirmed.has(r.id)
  );

  return (
    <div className="space-y-3">
      {/* Disclaimer banner */}
      {hasUnconfirmed && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              Platform certification required
            </p>
            <p className="text-sm text-amber-800 mt-1">
              The categories you&apos;ve selected require specific platform certifications.
              Ads checked <strong>without</strong> the required certification will receive{" "}
              <strong>automatic compliance failures</strong> on certification-related rules
              and will still consume your Checkdits. If you hold the certification, confirm
              it below to get accurate results.
            </p>
          </div>
        </div>
      )}

      {/* Certification cards */}
      {required.map((cert) => {
        const isConfirmed = confirmed.has(cert.id);
        const isAcknowledged = acknowledgedWithout.has(cert.id);

        return (
          <div
            key={cert.id}
            className={cn(
              "rounded-xl border p-4 space-y-3 transition-colors",
              isConfirmed
                ? "border-emerald-200 bg-emerald-50/50"
                : isAcknowledged
                ? "border-slate-200 bg-slate-50"
                : "border-amber-200 bg-white"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {isConfirmed ? (
                  <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {cert.name}
                    </p>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {cert.platform.name}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{cert.description}</p>
                  {cert.affectedCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {cert.affectedCategories.map((cat) => (
                        <Badge
                          key={cat}
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 text-slate-500"
                        >
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {cert.infoUrl && (
                <a
                  href={cert.infoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-[#1A56DB] transition-colors shrink-0"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>

            {/* Actions */}
            {isConfirmed ? (
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                <span>Certification confirmed — results will reflect this</span>
              </div>
            ) : isAcknowledged ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>
                  Proceeding without certification — certification-related rules
                  will be flagged as failures
                </span>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleConfirm(cert.id)}
                  disabled={saving === cert.id}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {saving === cert.id ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Yes, I hold this certification
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleAcknowledgeWithout(cert.id)}
                  className="text-slate-500 hover:text-slate-700"
                >
                  Continue without certification
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {/* Summary when all resolved */}
      {allResolved && unresolved.length === 0 && (
        <div className="text-xs text-slate-400 text-center py-1">
          All certification requirements addressed
        </div>
      )}
    </div>
  );
}
