import { Resend } from "resend";
import { requireEmailEnvironment } from "./environment";

async function sendEmail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}) {
  const environment = requireEmailEnvironment();
  const resend = new Resend(environment.AUTH_RESEND_KEY);
  const result = await resend.emails.send({
    from: environment.AUTH_EMAIL_FROM,
    to,
    subject,
    text,
  });

  if (result.error) {
    throw new Error("Authentication email delivery failed.");
  }
}

function authUrl(path: string, token: string) {
  const environment = requireEmailEnvironment();
  const url = new URL(path, environment.AUTH_URL);
  url.searchParams.set("token", token);
  return url.toString();
}

export function sendVerificationEmail(email: string, token: string) {
  const url = authUrl("/verify-email", token);

  return sendEmail({
    to: email,
    subject: "Verify your Aurbit email",
    text: `Verify your Aurbit email address by opening this link:\n\n${url}\n\nThis link expires in one hour. If you did not create an Aurbit account, you can ignore this email.`,
  });
}

export function sendPasswordResetEmail(email: string, token: string) {
  const url = authUrl("/reset-password", token);

  return sendEmail({
    to: email,
    subject: "Reset your Aurbit password",
    text: `Reset your Aurbit password by opening this link:\n\n${url}\n\nThis link expires in one hour. If you did not request a password reset, you can ignore this email.`,
  });
}
