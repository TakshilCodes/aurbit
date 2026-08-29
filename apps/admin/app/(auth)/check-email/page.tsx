import { PageHeader } from "@aurbit/ui/page-header";
import type { Metadata } from "next";
import Link from "next/link";
import { safeRedirectPath } from "../../../lib/validation";
import { resendVerificationAction } from "../actions";
import { AuthFooter } from "../components/auth-patterns";
import { EmailActionForm } from "../components/email-action-form";

export const metadata: Metadata = { title: "Check your email | Aurbit" };

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; type?: string }>;
}) {
  const params = await searchParams;
  const verification = params.type === "verification";
  const redirectTo = safeRedirectPath(params.callbackUrl ?? null);
  const loginQuery = new URLSearchParams({
    callbackUrl: redirectTo,
  }).toString();

  return (
    <>
      <PageHeader
        description={
          verification
            ? "Open the verification link to activate your password account."
            : "Open the sign-in link to continue to Aurbit."
        }
        size="compact"
        title="Check your email"
      />
      {verification ? (
        <EmailActionForm
          action={resendVerificationAction}
          buttonLabel="Resend verification link"
          pendingLabel="Sending link…"
          redirectTo={redirectTo}
          turnstileAction="resend-verification"
        />
      ) : null}
      <AuthFooter>
        <p>
          <Link href={`/login?${loginQuery}`}>Back to sign in</Link>
        </p>
      </AuthFooter>
    </>
  );
}
