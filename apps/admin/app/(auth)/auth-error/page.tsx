import { Alert } from "@aurbit/ui/alert";
import { PageHeader } from "@aurbit/ui/page-header";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthFooter } from "../components/auth-patterns";

export const metadata: Metadata = { title: "Authentication error | Aurbit" };

export default function AuthErrorPage() {
  return (
    <>
      <PageHeader
        description="The authentication request could not be completed safely."
        size="compact"
        title="Could not sign you in"
      />
      <Alert role="alert">Try again or choose another sign-in method.</Alert>
      <AuthFooter>
        <p>
          <Link href="/login">Back to sign in</Link>
        </p>
      </AuthFooter>
    </>
  );
}
