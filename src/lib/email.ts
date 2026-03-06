import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM ?? "noreply@adcompliancepro.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendConsolidatedScanEmail(
  summary: { sourcesScanned: number; sourcesChanged: number; changesCreated: number; errors: { sourceUrl: string; error: string }[] },
  changedSources: { label: string; url: string; changesCount: number }[]
) {
  const totalChanges = summary.changesCreated;

  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.includes("REPLACE")) {
    console.log(
      `\n[scan] Scan complete — ${summary.sourcesScanned} scanned, ${summary.sourcesChanged} changed, ${totalChanges} proposed change(s). Review at /admin/proposed-changes\n`,
      changedSources.map((s) => `  • ${s.label}: ${s.changesCount} change(s)`).join("\n")
    );
    return;
  }

  const admins = await import("@/lib/db").then(({ db }) =>
    db.user.findMany({ where: { role: "ADMIN", active: true }, select: { email: true } })
  );

  const reviewUrl = `${APP_URL}/admin/proposed-changes`;

  const sourceRows = changedSources
    .map(
      (s) =>
        `<tr>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${s.label}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;"><a href="${s.url}" style="color:#3b82f6;">${s.url}</a></td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:center;">${s.changesCount}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #0f172a;">Policy scan complete</h2>
      <p style="color:#475569;">
        <strong>${summary.sourcesScanned}</strong> source${summary.sourcesScanned !== 1 ? "s" : ""} scanned —
        <strong>${summary.sourcesChanged}</strong> changed —
        <strong>${totalChanges}</strong> proposed change${totalChanges !== 1 ? "s" : ""} created.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:6px 8px;text-align:left;border-bottom:2px solid #e2e8f0;">Source</th>
            <th style="padding:6px 8px;text-align:left;border-bottom:2px solid #e2e8f0;">URL</th>
            <th style="padding:6px 8px;text-align:center;border-bottom:2px solid #e2e8f0;">Changes</th>
          </tr>
        </thead>
        <tbody>${sourceRows}</tbody>
      </table>
      ${summary.errors.length > 0 ? `<p style="color:#b45309;font-size:13px;">${summary.errors.length} source(s) could not be fetched.</p>` : ""}
      <a href="${reviewUrl}"
         style="display:inline-block;background:#0f172a;color:#fff;padding:12px 24px;
                border-radius:6px;text-decoration:none;font-weight:600;margin:8px 0 16px;">
        Review Proposed Changes
      </a>
    </div>
  `;

  await Promise.allSettled(
    admins.map((a) =>
      getResend().emails.send({
        from: FROM,
        to: a.email,
        subject: `AdCompliance Pro: ${totalChanges} policy change${totalChanges !== 1 ? "s" : ""} detected across ${summary.sourcesChanged} source${summary.sourcesChanged !== 1 ? "s" : ""}`,
        html,
      })
    )
  );
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  // In development without Resend configured, log to console
  if (
    !process.env.RESEND_API_KEY ||
    process.env.RESEND_API_KEY.includes("REPLACE")
  ) {
    console.log("\n📧 Password Reset Link (dev — Resend not configured):");
    console.log(resetUrl, "\n");
    return;
  }

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: "Reset your AdCompliance Pro password",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #0f172a;">Reset your password</h2>
        <p>You requested a password reset for your AdCompliance Pro account.</p>
        <p>Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.</p>
        <a href="${resetUrl}"
           style="display:inline-block;background:#0f172a;color:#fff;padding:12px 24px;
                  border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0;">
          Reset Password
        </a>
        <p style="color:#64748b;font-size:13px;">
          If you didn't request this, you can safely ignore this email.
        </p>
        <p style="color:#64748b;font-size:13px;">
          Or copy this link: ${resetUrl}
        </p>
      </div>
    `,
  });
}
