import { AuthTokenType, db } from "@aurbit/db";
import { hashToken } from "./tokens";
import { verificationTokenSchema } from "./validation";

export async function verifyEmailToken(value: unknown) {
  const parsed = verificationTokenSchema.safeParse({ token: value });

  if (!parsed.success) {
    return false;
  }

  const tokenHash = await hashToken(parsed.data.token);

  return db.$transaction(async (transaction) => {
    const token = await transaction.authToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, type: true, expiresAt: true },
    });

    if (
      !token ||
      token.type !== AuthTokenType.EMAIL_VERIFICATION ||
      token.expiresAt <= new Date()
    ) {
      return false;
    }

    const consumed = await transaction.authToken.deleteMany({
      where: { id: token.id, expiresAt: { gt: new Date() } },
    });

    if (consumed.count !== 1) {
      return false;
    }

    await transaction.user.update({
      where: { id: token.userId },
      data: { emailVerified: new Date() },
      select: { id: true },
    });

    return true;
  });
}
