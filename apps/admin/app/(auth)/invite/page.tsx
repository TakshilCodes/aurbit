import { Alert } from "@aurbit/ui/alert";
import { buttonStyles } from "@aurbit/ui/button";
import { PageHeader } from "@aurbit/ui/page-header";
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "../../../auth";
import { getWorkspaceInvitePreview } from "../../../lib/workspace-invitations";
import { AcceptInviteForm } from "./accept-invite-form";

export const metadata: Metadata = { title: "Workspace invitation | Aurbit" };
export const dynamic = "force-dynamic";

const STATUS_COPY = {
  accepted: "This invitation has already been accepted.",
  expired: "This invitation has expired. Ask a workspace admin to resend it.",
  invalid: "This invitation link is invalid.",
  revoked: "This invitation has been revoked by the workspace.",
} as const;

function callbackPath(token: string) {
  return `/invite?${new URLSearchParams({ token }).toString()}`;
}

export default async function WorkspaceInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const preview = await getWorkspaceInvitePreview(token);

  if (preview.status !== "valid") {
    return (
      <>
        <PageHeader
          description="This invitation cannot be used."
          size="compact"
          title="Invitation unavailable"
        />
        <Alert role="alert">{STATUS_COPY[preview.status]}</Alert>
        <p className="mt-5 text-sm text-muted">
          <Link href="/login">Return to sign in</Link>
        </p>
      </>
    );
  }

  const session = await auth();
  const callbackUrl = callbackPath(token);
  const authQuery = new URLSearchParams({ callbackUrl }).toString();
  const inviterName =
    preview.invite.invitedBy.name?.trim() || preview.invite.invitedBy.email;
  const role = preview.invite.role === "ADMIN" ? "Admin" : "Member";
  const wrongEmail =
    session?.user?.email &&
    session.user.email.trim().toLowerCase() !== preview.invite.email;

  return (
    <>
      <PageHeader
        description={`${inviterName} invited you to join ${preview.invite.organization.name}.`}
        size="compact"
        title="Join this workspace"
      />
      <dl className="mb-6 grid gap-3 rounded-lg border border-border bg-surface p-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Workspace</dt>
          <dd className="text-right font-medium text-primary">
            {preview.invite.organization.name}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Invited email</dt>
          <dd className="break-all text-right text-primary">
            {preview.invite.email}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Role</dt>
          <dd className="text-right text-primary">{role}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Invited by</dt>
          <dd className="text-right text-primary">{inviterName}</dd>
        </div>
      </dl>

      {wrongEmail ? (
        <Alert role="alert">
          This invitation is for {preview.invite.email}. Sign out and use that
          verified email to accept it.
        </Alert>
      ) : session?.user ? (
        <AcceptInviteForm token={token} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link className={buttonStyles()} href={`/login?${authQuery}`}>
            Sign in to continue
          </Link>
          <Link
            className={buttonStyles({ variant: "secondary" })}
            href={`/signup?${authQuery}`}
          >
            Create an account
          </Link>
        </div>
      )}
      <p className="mt-5 text-xs leading-5 text-muted">
        Opening this page does not accept the invitation. Membership is created
        only after you sign in and confirm.
      </p>
    </>
  );
}
