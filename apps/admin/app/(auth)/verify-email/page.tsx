import { Alert } from "@aurbit/ui/alert";
import { PageHeader } from "@aurbit/ui/page-header";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyEmailToken } from "../../../lib/email-verification";
import { safeRedirectPath } from "../../../lib/validation";
import { AuthFooter } from "../components/auth-patterns";

export const metadata: Metadata = { title: "Verify email | Aurbit" };
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; token?: string }>;
}) {
  const params = await searchParams;
  const redirectTo = safeRedirectPath(params.callbackUrl ?? null);
  const verified = await verifyEmailToken(params.token ?? "");
  const authQuery = new URLSearchParams({ callbackUrl: redirectTo }).toString();

  if (verified) {
    redirect(`/login?verified=1&${authQuery}`);
  }

  return (
    <>
      <PageHeader
        description="This verification link may have expired or already been used."
        size="compact"
        title="Couldn't verify email"
      />
      <Alert role="alert">This verification link is invalid or expired.</Alert>
      <AuthFooter>
        <p>
          <Link href={`/check-email?type=verification&${authQuery}`}>
            Request another link
          </Link>
        </p>
        <p>
          <Link href={`/login?${authQuery}`}>Back to sign in</Link>
        </p>
      </AuthFooter>
    </>
  );
}
