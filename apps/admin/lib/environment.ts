import { z } from "zod";

function optionalEnvironmentValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const googleId = optionalEnvironmentValue(process.env.AUTH_GOOGLE_ID);
const googleSecret = optionalEnvironmentValue(process.env.AUTH_GOOGLE_SECRET);
const resendKey = optionalEnvironmentValue(process.env.AUTH_RESEND_KEY);
const emailFrom = optionalEnvironmentValue(process.env.AUTH_EMAIL_FROM);

export const authCapabilities = {
  google: Boolean(googleId && googleSecret),
  email: Boolean(resendKey && emailFrom),
} as const;

export const optionalAuthEnvironment = {
  googleId,
  googleSecret,
  resendKey,
  emailFrom,
};

const emailEnvironmentSchema = z.object({
  AUTH_RESEND_KEY: z.string().trim().min(1),
  AUTH_EMAIL_FROM: z.string().trim().min(1),
  AUTH_URL: z.string().url(),
});

export function requireEmailEnvironment() {
  return emailEnvironmentSchema.parse({
    AUTH_RESEND_KEY: process.env.AUTH_RESEND_KEY,
    AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM,
    AUTH_URL: process.env.AUTH_URL,
  });
}
