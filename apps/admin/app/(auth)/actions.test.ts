import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  issueAuthToken: vi.fn(() => Promise.resolve("token")),
  sendPasswordResetEmail: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock("@aurbit/db", () => ({
  AuthTokenType: {
    EMAIL_VERIFICATION: "EMAIL_VERIFICATION",
    PASSWORD_RESET: "PASSWORD_RESET",
  },
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {},
  },
  db: {
    user: {
      findUnique: mocks.findUnique,
    },
  },
}));

vi.mock("next-auth", () => ({
  AuthError: class AuthError extends Error {},
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("../../auth", () => ({ signIn: mocks.signIn }));

vi.mock("../../lib/auth-protection", () => ({
  getClientIp: vi.fn(() => Promise.resolve("203.0.113.8")),
  runProtectedAuthOperation: vi.fn(
    async <T>(_input: unknown, operation: () => Promise<T>) => ({
      allowed: true,
      value: await operation(),
    }),
  ),
}));

vi.mock("../../lib/email", () => ({
  sendPasswordResetEmail: mocks.sendPasswordResetEmail,
  sendVerificationEmail: vi.fn(),
}));

vi.mock("../../lib/environment", () => ({
  authCapabilities: { email: true, google: true },
}));

vi.mock("../../lib/password", () => ({ hashPassword: vi.fn() }));

vi.mock("../../lib/tokens", () => ({
  hashToken: vi.fn(),
  issueAuthToken: mocks.issueAuthToken,
}));

import { forgotPasswordAction, magicLinkAction } from "./actions";

function emailForm(email: string) {
  const formData = new FormData();
  formData.set("email", email);
  formData.set("cf-turnstile-response", "valid-token");
  return formData;
}

describe("enumeration-safe authentication actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the same forgot-password response whether the account exists", async () => {
    mocks.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "user_1",
      email: "user@example.com",
      emailVerified: new Date(),
      passwordHash: "hash",
    });

    const unknown = await forgotPasswordAction(
      {},
      emailForm("unknown@example.com"),
    );
    const existing = await forgotPasswordAction(
      {},
      emailForm("user@example.com"),
    );

    expect(unknown).toEqual(existing);
    expect(existing).toEqual({
      success:
        "If that address has a password account, a reset link has been sent.",
    });
  });

  it("returns the same magic-link response for different email addresses", async () => {
    const first = await magicLinkAction({}, emailForm("first@example.com"));
    const second = await magicLinkAction({}, emailForm("second@example.com"));

    expect(first).toEqual(second);
    expect(first).toEqual({});
    expect(mocks.signIn).toHaveBeenCalledTimes(2);
  });
});
