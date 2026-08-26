import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const authToken = {
    deleteMany: vi.fn(),
    findUnique: vi.fn(),
  };
  const user = {
    update: vi.fn(),
  };
  const transactionClient = { authToken, user };
  const transaction = vi.fn(
    async (operation: (client: typeof transactionClient) => Promise<boolean>) =>
      operation(transactionClient),
  );

  return { authToken, transaction, user };
});

vi.mock("@aurbit/db", () => ({
  AuthTokenType: {
    EMAIL_VERIFICATION: "EMAIL_VERIFICATION",
    PASSWORD_RESET: "PASSWORD_RESET",
  },
  db: {
    $transaction: mocks.transaction,
  },
}));

import { verifyEmailToken } from "./email-verification";

const validToken = "a".repeat(64);

describe("email verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("verifies a valid token and consumes it", async () => {
    const now = new Date("2026-08-26T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    mocks.authToken.findUnique.mockResolvedValue({
      id: "token_1",
      userId: "user_1",
      type: "EMAIL_VERIFICATION",
      expiresAt: new Date(Date.now() + 60_000),
    });
    mocks.authToken.deleteMany.mockResolvedValue({ count: 1 });
    mocks.user.update.mockResolvedValue({ id: "user_1" });

    await expect(verifyEmailToken(validToken)).resolves.toBe(true);
    expect(mocks.authToken.deleteMany).toHaveBeenCalledOnce();
    expect(mocks.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { emailVerified: now },
      select: { id: true },
    });
  });

  it("rejects an invalid token before accessing the database", async () => {
    await expect(verifyEmailToken("invalid")).resolves.toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects an expired token without consuming it", async () => {
    mocks.authToken.findUnique.mockResolvedValue({
      id: "token_1",
      userId: "user_1",
      type: "EMAIL_VERIFICATION",
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expect(verifyEmailToken(validToken)).resolves.toBe(false);
    expect(mocks.authToken.deleteMany).not.toHaveBeenCalled();
    expect(mocks.user.update).not.toHaveBeenCalled();
  });

  it("rejects a token that has already been consumed", async () => {
    mocks.authToken.findUnique.mockResolvedValue(null);

    await expect(verifyEmailToken(validToken)).resolves.toBe(false);
    expect(mocks.authToken.deleteMany).not.toHaveBeenCalled();
    expect(mocks.user.update).not.toHaveBeenCalled();
  });
});
