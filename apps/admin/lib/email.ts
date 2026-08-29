import { Resend } from "resend";
import { requireEmailEnvironment } from "./environment";
import { createVerificationEmail } from "./verification-email";
import { createWorkspaceInvitationEmail } from "./invitation-email";

async function sendEmail({
  html,
  subject,
  text,
  to,
}: {
  html?: string;
  subject: string;
  text: string;
  to: string;
}) {
  const environment = requireEmailEnvironment();
  const resend = new Resend(environment.AUTH_RESEND_KEY);
  const result = await resend.emails.send({
    from: environment.AUTH_EMAIL_FROM,
    html,
    subject,
    text,
    to,
  });

  if (result.error) {
    throw new Error("Authentication email delivery failed.");
  }
}

function authUrl(path: string, token: string, redirectTo = "/") {
  const environment = requireEmailEnvironment();
  const url = new URL(path, environment.AUTH_URL);
  url.searchParams.set("token", token);
  if (redirectTo !== "/") url.searchParams.set("callbackUrl", redirectTo);
  return url.toString();
}

function authAssetUrl(path: string) {
  const environment = requireEmailEnvironment();
  return new URL(path, environment.AUTH_URL).toString();
}

export function sendVerificationEmail(
  email: string,
  token: string,
  redirectTo = "/",
) {
  const verificationUrl = authUrl("/verify-email", token, redirectTo);
  const content = createVerificationEmail({
    logoUrl: authAssetUrl("/brand/aurbit-wordmark.png"),
    verificationUrl,
  });

  return sendEmail({
    ...content,
    to: email,
    subject: "Verify your Aurbit email",
  });
}

export function sendPasswordResetEmail(email: string, token: string) {
  const url = authUrl("/reset-password", token);

  return sendEmail({
    to: email,
    subject: "Reset your Aurbit password",
    text: `Reset your Aurbit password by opening this link:

${url}

This link expires in one hour. If you did not request a password reset, you can ignore this email.`,
  });
}

export function sendWorkspaceInvitationEmail({
  email,
  expiresAt,
  inviterName,
  role,
  token,
  workspaceName,
}: {
  email: string;
  expiresAt: Date;
  inviterName: string;
  role: "ADMIN" | "MEMBER";
  token: string;
  workspaceName: string;
}) {
  const environment = requireEmailEnvironment();
  const invitationUrl = new URL("/invite", environment.AUTH_URL);
  invitationUrl.searchParams.set("token", token);
  const content = createWorkspaceInvitationEmail({
    expiryDate: new Intl.DateTimeFormat("en", {
      dateStyle: "long",
      timeZone: "UTC",
    }).format(expiresAt),
    invitationUrl: invitationUrl.toString(),
    inviterName,
    logoUrl: authAssetUrl("/brand/aurbit-wordmark.png"),
    role: role === "ADMIN" ? "Admin" : "Member",
    workspaceName,
  });

  return sendEmail({ ...content, to: email });
}
