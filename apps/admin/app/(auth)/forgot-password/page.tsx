import { PageHeader } from "@aurbit/ui/page-header";
import type { Metadata } from "next";
import Link from "next/link";
import { forgotPasswordAction } from "../actions";
import { AuthFooter } from "../components/auth-patterns";
import { EmailActionForm } from "../components/email-action-form";

export const metadata: Metadata = { title: "Forgot password | Aurbit" };

export default function ForgotPasswordPage() {
  return (
    <>
      <PageHeader
        description="We will send a short-lived reset link if the account is eligible."
        size="compact"
        title="Reset your password"
      />
      <EmailActionForm
        action={forgotPasswordAction}
        buttonLabel="Send reset link"
        pendingLabel="Sending link…"
        turnstileAction="forgot-password"
      />
      <AuthFooter>
        <p>
          <Link href="/login">Back to sign in</Link>
        </p>
      </AuthFooter>
    </>
  );
}
