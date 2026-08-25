import { Alert } from "@aurbit/ui/alert";
import { PageHeader } from "@aurbit/ui/page-header";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthFooter } from "../components/auth-patterns";
import { ResetPasswordForm } from "../components/token-action-form";

export const metadata: Metadata = { title: "Reset password | Aurbit" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;

  return (
    <>
      <PageHeader
        description="Your reset link is single-use and expires after one hour."
        size="compact"
        title="Choose a new password"
      />
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Alert role="alert">
          This password reset link is invalid or expired.
        </Alert>
      )}
      <AuthFooter>
        <p>
          <Link href="/forgot-password">Request another link</Link>
        </p>
      </AuthFooter>
    </>
  );
}
