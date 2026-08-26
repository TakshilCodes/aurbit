function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function createVerificationEmail({
  logoUrl,
  verificationUrl,
}: {
  logoUrl: string;
  verificationUrl: string;
}) {
  const safeLogoUrl = escapeHtml(logoUrl);
  const safeVerificationUrl = escapeHtml(verificationUrl);

  return {
    html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>Verify your Aurbit email</title>
    <style>
      @media (prefers-color-scheme: dark) {
        .email-page { background-color: #09090b !important; }
        .email-card { background-color: #111113 !important; border-color: #2b2b30 !important; }
        .email-title { color: #fafafa !important; }
        .email-copy { color: #b4b4bc !important; }
        .email-rule { border-color: #2b2b30 !important; }
        .email-button { background-color: #fafafa !important; color: #09090b !important; }
        .email-fallback { color: #8d8d96 !important; }
        .email-link { color: #d4d4d8 !important; }
      }
    </style>
  </head>
  <body class="email-page" style="margin:0;padding:0;background-color:#f4f4f5;color:#18181b;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Confirm your email address to finish creating your Aurbit account.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-page" style="width:100%;background-color:#f4f4f5;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-card" style="width:100%;max-width:560px;background-color:#ffffff;border:1px solid #d4d4d8;border-radius:12px;">
            <tr>
              <td style="background-color:#09090b;border-radius:11px 11px 0 0;padding:24px 32px;">
                <img src="${safeLogoUrl}" width="132" alt="Aurbit" style="display:block;width:132px;max-width:100%;height:auto;border:0;">
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 32px;">
                <h1 class="email-title" style="margin:0 0 14px;color:#18181b;font-size:26px;line-height:34px;font-weight:650;letter-spacing:-0.5px;">Verify your email</h1>
                <p class="email-copy" style="margin:0 0 28px;color:#52525b;font-size:15px;line-height:24px;">Confirm your email address to finish creating your Aurbit account.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 28px;">
                  <tr>
                    <td bgcolor="#09090b" style="border-radius:8px;mso-padding-alt:12px 22px;">
                      <a href="${safeVerificationUrl}" class="email-button" style="display:inline-block;background-color:#09090b;border:1px solid #09090b;border-radius:8px;color:#ffffff;font-size:14px;font-weight:650;line-height:20px;padding:12px 22px;text-decoration:none;">Verify email</a>
                    </td>
                  </tr>
                </table>
                <p class="email-copy" style="margin:0 0 8px;color:#52525b;font-size:13px;line-height:21px;">This link expires in 1 hour.</p>
                <p class="email-copy" style="margin:0;color:#52525b;font-size:13px;line-height:21px;">If you didn't create an Aurbit account, you can safely ignore this email.</p>
                <hr class="email-rule" style="margin:28px 0 22px;border:0;border-top:1px solid #e4e4e7;">
                <p class="email-fallback" style="margin:0 0 8px;color:#71717a;font-size:12px;line-height:18px;">If the button does not work, copy and paste this URL into your browser:</p>
                <p style="margin:0;word-break:break-all;"><a href="${safeVerificationUrl}" class="email-link" style="color:#3f3f46;font-size:12px;line-height:18px;text-decoration:underline;">${safeVerificationUrl}</a></p>
              </td>
            </tr>
          </table>
          <p class="email-fallback" style="margin:18px 0 0;color:#71717a;font-size:11px;line-height:18px;">Aurbit account security</p>
        </td>
      </tr>
    </table>
  </body>
</html>`,
    text: `Verify your email

Confirm your email address to finish creating your Aurbit account.

Verify email:
${verificationUrl}

This link expires in 1 hour.

If you didn't create an Aurbit account, you can safely ignore this email.`,
  };
}
