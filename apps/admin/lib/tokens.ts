import { AuthTokenType, db } from "@aurbit/db";

const encoder = new TextEncoder();

export const AUTH_TOKEN_LIFETIME_MS = 60 * 60 * 1000;

export function generateSecureToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function issueAuthToken(userId: string, type: AuthTokenType) {
  const token = generateSecureToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + AUTH_TOKEN_LIFETIME_MS);

  await db.$transaction([
    db.authToken.deleteMany({ where: { userId, type } }),
    db.authToken.create({
      data: { userId, type, tokenHash, expiresAt },
      select: { id: true },
    }),
  ]);

  return token;
}

export function generateOrganizationSlug(name: string) {
  const base = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const suffix = generateSecureToken().slice(0, 8);

  return `${base || "organization"}-${suffix}`;
}

export function generatePublicProjectKey() {
  return `pk_proj_${generateSecureToken().slice(0, 24)}`;
}
