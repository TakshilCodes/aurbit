import { Alert } from "@aurbit/ui/alert";
import { PageHeader } from "@aurbit/ui/page-header";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyEmailToken } from "../../../lib/email-verification";
import { AuthFooter } from "../components/auth-patterns";

export const metadata: Metadata = { title: "Verify email | Aurbit" };
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const verified = await verifyEmailToken(token);

  if (verified) {
    redirect("/login?verified=1");
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
          <Link href="/check-email?type=verification">
            Request another link
          </Link>
        </p>
        <p>
          <Link href="/login">Back to sign in</Link>
        </p>
      </AuthFooter>
    </>
  );
}
