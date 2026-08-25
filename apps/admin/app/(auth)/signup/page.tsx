import { PageHeader } from "@aurbit/ui/page-header";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { authCapabilities } from "../../../lib/environment";
import { AuthFooter } from "../components/auth-patterns";
import { SignupForm } from "../components/signup-form";

export const metadata: Metadata = { title: "Create account | Aurbit" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <>
      <PageHeader
        description="Use Google or create a verified password account."
        size="compact"
        title="Create your account"
      />
      <SignupForm googleEnabled={authCapabilities.google} />
      <AuthFooter>
        <p>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </AuthFooter>
    </>
  );
}
