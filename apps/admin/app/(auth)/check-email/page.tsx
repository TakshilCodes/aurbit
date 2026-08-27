import { PageHeader } from "@aurbit/ui/page-header";
import type { Metadata } from "next";
import Link from "next/link";
import { resendVerificationAction } from "../actions";
import { AuthFooter } from "../components/auth-patterns";
import { EmailActionForm } from "../components/email-action-form";

export const metadata: Metadata = { title: "Check your email | Aurbit" };

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const verification = type === "verification";

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
          turnstileAction="resend-verification"
        />
      ) : null}
      <AuthFooter>
        <p>
          <Link href="/login">Back to sign in</Link>
        </p>
      </AuthFooter>
    </>
  );
}
