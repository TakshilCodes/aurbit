import { Alert } from "@aurbit/ui/alert";
import { PageHeader } from "@aurbit/ui/page-header";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthFooter } from "../components/auth-patterns";
import { VerifyEmailForm } from "../components/token-action-form";

export const metadata: Metadata = { title: "Verify email | Aurbit" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;

  return (
    <>
      <PageHeader
        description="Confirm this email address before signing in with a password."
        size="compact"
        title="Verify your email"
      />
      {token ? (
        <VerifyEmailForm token={token} />
      ) : (
        <Alert role="alert">
          This verification link is invalid or expired.
        </Alert>
      )}
      <AuthFooter>
        <p>
          <Link href="/check-email?type=verification">
            Request another link
          </Link>
        </p>
      </AuthFooter>
    </>
  );
}
