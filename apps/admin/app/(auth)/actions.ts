"use server";

import { AuthTokenType, db, Prisma } from "@aurbit/db";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "../../auth";
import {
  getClientIp,
  runProtectedAuthOperation,
  type AuthProtectionFailure,
  type AuthProtectionFlow,
} from "../../lib/auth-protection";
import { sendPasswordResetEmail, sendVerificationEmail } from "../../lib/email";
import { authCapabilities } from "../../lib/environment";
import { hashPassword } from "../../lib/password";
import { hashToken, issueAuthToken } from "../../lib/tokens";
import {
  emailSchemaInput,
  loginSchema,
  resetPasswordSchema,
  safeRedirectPath,
  signupSchema,
} from "../../lib/validation";

export type AuthField =
  | "name"
  | "email"
  | "password"
  | "confirmPassword"
  | "token";

export type AuthActionState = {
  error?: string;
  success?: string;
  fieldErrors?: Partial<Record<AuthField, string[]>>;
};

function protectionError(reason: AuthProtectionFailure): AuthActionState {
  if (reason === "rate-limited") {
    return { error: "Too many attempts. Please wait and try again." };
  }

  if (reason === "turnstile-invalid") {
    return { error: "Security verification failed or expired. Try again." };
  }

  return { error: "Unable to verify this request right now. Try again." };
}

async function protect<T>(
  flow: AuthProtectionFlow,
  formData: FormData,
  operation: () => Promise<T>,
  email?: string,
) {
  return runProtectedAuthOperation(
    {
      flow,
      ip: await getClientIp(),
      email,
      turnstileToken: formData.get("cf-turnstile-response"),
    },
    operation,
  );
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const result = await protect(
    "login",
    formData,
    async (): Promise<AuthActionState> => {
      try {
        await signIn("credentials", {
          ...parsed.data,
          redirectTo: safeRedirectPath(formData.get("redirectTo")),
        });
      } catch (error) {
        if (error instanceof AuthError) {
          return { error: "Invalid email or password." };
        }

        throw error;
      }

      return {};
    },
    parsed.data.email,
  );

  return result.allowed ? result.value : protectionError(result.reason);
}

export async function googleLoginAction() {
  if (!authCapabilities.google) {
    redirect("/auth-error");
  }

  await signIn("google", { redirectTo: "/" });
}

export async function magicLinkAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = emailSchemaInput.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (!authCapabilities.email) {
    return { error: "Email sign-in is not configured yet." };
  }

  const result = await protect(
    "magic-link",
    formData,
    async (): Promise<AuthActionState> => {
      try {
        await signIn("resend", {
          email: parsed.data.email,
          redirectTo: safeRedirectPath(formData.get("redirectTo")),
        });
      } catch (error) {
        if (error instanceof AuthError) {
          return { error: "Unable to send a sign-in link. Try again." };
        }

        throw error;
      }

      return {};
    },
    parsed.data.email,
  );

  return result.allowed ? result.value : protectionError(result.reason);
}

export async function signupAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (!authCapabilities.email) {
    return { error: "Email verification is not configured yet." };
  }

  const result = await protect(
    "signup",
    formData,
    async (): Promise<AuthActionState> => {
      const passwordHash = await hashPassword(parsed.data.password);
      let userId: string;

      try {
        const user = await db.user.create({
          data: {
            name: parsed.data.name,
            email: parsed.data.email,
            passwordHash,
          },
          select: { id: true },
        });
        userId = user.id;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          return {
            fieldErrors: {
              email: [
                "An account already exists with this email. Sign in instead or reset your password.",
              ],
            },
          };
        }

        throw error;
      }

      const token = await issueAuthToken(
        userId,
        AuthTokenType.EMAIL_VERIFICATION,
      );

      try {
        await sendVerificationEmail(parsed.data.email, token);
      } catch {
        return {
          error:
            "Your account was created, but the verification email could not be sent. Request a new link below.",
        };
      }

      redirect("/check-email?type=verification");
    },
  );

  return result.allowed ? result.value : protectionError(result.reason);
}

export async function resendVerificationAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = emailSchemaInput.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const result = await protect(
    "resend-verification",
    formData,
    async (): Promise<AuthActionState> => {
      if (authCapabilities.email) {
        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
          select: { id: true, emailVerified: true },
        });

        if (user && !user.emailVerified) {
          try {
            const token = await issueAuthToken(
              user.id,
              AuthTokenType.EMAIL_VERIFICATION,
            );
            await sendVerificationEmail(parsed.data.email, token);
          } catch {
            // Keep the response indistinguishable from an unknown email address.
          }
        }
      }

      return {
        success:
          "If that address has an unverified account, a new link has been sent.",
      };
    },
    parsed.data.email,
  );

  return result.allowed ? result.value : protectionError(result.reason);
}

export async function forgotPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = emailSchemaInput.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const result = await protect(
    "forgot-password",
    formData,
    async (): Promise<AuthActionState> => {
      if (authCapabilities.email) {
        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
          select: {
            id: true,
            email: true,
            emailVerified: true,
            passwordHash: true,
          },
        });

        if (user?.emailVerified && user.passwordHash) {
          try {
            const token = await issueAuthToken(
              user.id,
              AuthTokenType.PASSWORD_RESET,
            );
            await sendPasswordResetEmail(user.email, token);
          } catch {
            // Keep the response indistinguishable from an unknown email address.
          }
        }
      }

      return {
        success:
          "If that address has a password account, a reset link has been sent.",
      };
    },
    parsed.data.email,
  );

  return result.allowed ? result.value : protectionError(result.reason);
}

export async function resetPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      error: fieldErrors.token
        ? "This password reset link is invalid or expired."
        : undefined,
      fieldErrors,
    };
  }

  const tokenHash = await hashToken(parsed.data.token);
  const passwordHash = await hashPassword(parsed.data.password);
  const reset = await db.$transaction(async (transaction) => {
    const token = await transaction.authToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, type: true, expiresAt: true },
    });

    if (
      !token ||
      token.type !== AuthTokenType.PASSWORD_RESET ||
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
      data: {
        passwordHash,
        sessionVersion: { increment: 1 },
      },
      select: { id: true },
    });
    await transaction.authToken.deleteMany({
      where: { userId: token.userId, type: AuthTokenType.PASSWORD_RESET },
    });

    return true;
  });

  if (!reset) {
    return { error: "This password reset link is invalid or expired." };
  }

  redirect("/login?reset=1");
}
