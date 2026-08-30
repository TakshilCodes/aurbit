function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function headerValue(value: string, maximumLength: number) {
  const normalized = value.replaceAll(/[\r\n]+/g, " ").trim();
  if (normalized.length <= maximumLength) return normalized;
  return `${normalized.slice(0, maximumLength - 1).trimEnd()}…`;
}

export function createReportCreatedEmail({
  createdAt,
  logoUrl,
  projectName,
  reportTitle,
  reporterEmail,
  reportUrl,
  workspaceName,
}: {
  createdAt: string;
  logoUrl: string;
  projectName: string;
  reporterEmail: string | null;
  reportTitle: string;
  reportUrl: string;
  workspaceName: string;
}) {
  const safeCreatedAt = escapeHtml(createdAt);
  const safeLogoUrl = escapeHtml(logoUrl);
  const safeProjectName = escapeHtml(projectName);
  const safeReporter = escapeHtml(reporterEmail ?? "Anonymous");
  const safeReportTitle = escapeHtml(reportTitle);
  const safeReportUrl = escapeHtml(reportUrl);
  const safeWorkspaceName = escapeHtml(workspaceName);
  const subject = `New bug report in ${headerValue(projectName, 48)}: ${headerValue(reportTitle, 86)}`;

  return {
    subject,
    html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>New bug report</title>
    <style>
      @media (prefers-color-scheme: dark) {
        .email-page { background-color:#09090b !important; }
        .email-card { background-color:#111113 !important; border-color:#2b2b30 !important; }
        .email-title { color:#fafafa !important; }
        .email-copy { color:#b4b4bc !important; }
        .email-rule { border-color:#2b2b30 !important; }
        .email-button { background-color:#fafafa !important; color:#09090b !important; }
        .email-muted { color:#8d8d96 !important; }
        .email-report { background-color:#18181b !important; border-color:#2b2b30 !important; color:#fafafa !important; }
      }
    </style>
  </head>
  <body class="email-page" style="margin:0;padding:0;background-color:#f4f4f5;color:#18181b;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">A new report was submitted to ${safeProjectName}.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-page" style="width:100%;background-color:#f4f4f5;">
      <tr><td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-card" style="width:100%;max-width:560px;background-color:#ffffff;border:1px solid #d4d4d8;border-radius:12px;">
          <tr><td style="background-color:#09090b;border-radius:11px 11px 0 0;padding:24px 32px;"><img src="${safeLogoUrl}" width="132" alt="Aurbit" style="display:block;width:132px;max-width:100%;height:auto;border:0;"></td></tr>
          <tr><td style="padding:36px 32px 32px;">
            <p class="email-muted" style="margin:0 0 10px;color:#71717a;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;">Report notification</p>
            <h1 class="email-title" style="margin:0 0 14px;color:#18181b;font-size:26px;line-height:34px;font-weight:650;letter-spacing:-.5px;">New bug report</h1>
            <p class="email-copy" style="margin:0 0 24px;color:#52525b;font-size:15px;line-height:24px;">A new report was submitted to <strong>${safeProjectName}</strong>.</p>
            <div class="email-report" style="margin:0 0 24px;padding:18px;background-color:#fafafa;border:1px solid #e4e4e7;border-radius:8px;color:#18181b;font-size:16px;font-weight:650;line-height:24px;">${safeReportTitle}</div>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 28px;">
              <tr><td class="email-muted" style="padding:0 0 8px;color:#71717a;font-size:12px;line-height:18px;width:90px;">Submitted</td><td class="email-copy" style="padding:0 0 8px;color:#3f3f46;font-size:13px;line-height:18px;">${safeCreatedAt}</td></tr>
              <tr><td class="email-muted" style="padding:0;color:#71717a;font-size:12px;line-height:18px;width:90px;">Reporter</td><td class="email-copy" style="padding:0;color:#3f3f46;font-size:13px;line-height:18px;">${safeReporter}</td></tr>
            </table>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 28px;"><tr><td bgcolor="#09090b" style="border-radius:8px;mso-padding-alt:12px 22px;"><a href="${safeReportUrl}" class="email-button" style="display:inline-block;background-color:#09090b;border:1px solid #09090b;border-radius:8px;color:#ffffff;font-size:14px;font-weight:650;line-height:20px;padding:12px 22px;text-decoration:none;">View report</a></td></tr></table>
            <hr class="email-rule" style="margin:0 0 22px;border:0;border-top:1px solid #e4e4e7;">
            <p class="email-muted" style="margin:0;color:#71717a;font-size:12px;line-height:20px;">Workspace: ${safeWorkspaceName}<br>Project: ${safeProjectName}</p>
          </td></tr>
        </table>
        <p class="email-muted" style="margin:18px 0 0;color:#71717a;font-size:11px;line-height:18px;">Aurbit · Bug reporting for product teams</p>
      </td></tr>
    </table>
  </body>
</html>`,
    text: `New bug report

A new report was submitted to ${projectName}.

${reportTitle}

Submitted: ${createdAt}
Reporter: ${reporterEmail ?? "Anonymous"}

View report:
${reportUrl}

Workspace: ${workspaceName}
Project: ${projectName}

Aurbit
Bug reporting for product teams`,
  };
}
