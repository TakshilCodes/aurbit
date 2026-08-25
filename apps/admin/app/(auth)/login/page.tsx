import { Alert } from "@aurbit/ui/alert";
import { PageHeader } from "@aurbit/ui/page-header";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { authCapabilities } from "../../../lib/environment";
import { safeRedirectPath } from "../../../lib/validation";
import { AuthFooter } from "../components/auth-patterns";
import { LoginForm } from "../components/login-form";

export const metadata: Metadata = { title: "Sign in | Aurbit" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    callbackUrl?: string;
    reset?: string;
    verified?: string;
  }>;
}) {
  const session = await auth();

  if (session?.user) redirect("/");

  const params = await searchParams;

  return (
    <>
      <PageHeader
        description="Continue to your Aurbit workspace."
        size="compact"
        title="Sign in"
      />
      <div className="mb-5 grid gap-3">
        {params.verified === "1" ? (
          <Alert role="status" variant="success">
            Email verified. You can now sign in.
          </Alert>
        ) : null}
        {params.reset === "1" ? (
          <Alert role="status" variant="success">
            Password reset. Sign in with your new password.
          </Alert>
        ) : null}
      </div>
      <LoginForm
        emailEnabled={authCapabilities.email}
        googleEnabled={authCapabilities.google}
        redirectTo={safeRedirectPath(params.callbackUrl ?? null)}
      />
      <AuthFooter>
        <p>
          <Link href="/forgot-password">Forgot your password?</Link>
        </p>
        <p>
          New to Aurbit? <Link href="/signup">Create an account</Link>
        </p>
      </AuthFooter>
    </>
  );
}
