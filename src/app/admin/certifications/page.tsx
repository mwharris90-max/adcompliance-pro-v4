import { db } from "@/lib/db";
import { ShieldAlert, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function CertificationsPage() {
  const certifications = await db.platformCertification.findMany({
    include: {
      platform: { select: { name: true } },
      orgCertifications: {
        where: { active: true },
        select: {
          id: true,
          userId: true,
          organisationId: true,
          declaredAt: true,
          notes: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Get category names for display
  const allCategoryIds = certifications.flatMap((c) => c.categoryIds);
  const categories = await db.category.findMany({
    where: { id: { in: allCategoryIds } },
    select: { id: true, name: true },
  });
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Platform Certifications</h1>
        <p className="text-sm text-slate-500 mt-1">
          Certification programmes that affect compliance checks. When users declare they hold
          a certification, certification-requirement flags are suppressed for the covered categories.
        </p>
      </div>

      <div className="grid gap-4">
        {certifications.map((cert) => (
          <Card key={cert.id} className="border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="h-5 w-5 text-amber-500" />
                  <div>
                    <CardTitle className="text-base">{cert.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">{cert.platform.name}</Badge>
                      {!cert.active && (
                        <Badge variant="outline" className="text-xs text-red-500 border-red-200">Inactive</Badge>
                      )}
                    </div>
                  </div>
                </div>
                {cert.infoUrl && (
                  <a
                    href={cert.infoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-[#1A56DB] transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">{cert.description}</p>

              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Covers categories:</p>
                <div className="flex flex-wrap gap-1">
                  {cert.categoryIds.map((cid) => (
                    <Badge key={cid} variant="outline" className="text-xs">
                      {catMap.get(cid) ?? cid}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-500 mb-1">
                  Declared by ({cert.orgCertifications.length}):
                </p>
                {cert.orgCertifications.length === 0 ? (
                  <p className="text-xs text-slate-400">No organisations have declared this certification yet.</p>
                ) : (
                  <div className="space-y-1">
                    {cert.orgCertifications.map((oc) => (
                      <div key={oc.id} className="text-xs text-slate-600">
                        {oc.organisationId ? `Org: ${oc.organisationId}` : `User: ${oc.userId}`}
                        {" — "}
                        {new Date(oc.declaredAt).toLocaleDateString()}
                        {oc.notes && <span className="text-slate-400"> ({oc.notes})</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
