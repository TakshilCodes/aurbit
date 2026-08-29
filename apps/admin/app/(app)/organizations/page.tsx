import { db } from "@aurbit/db";
import { Badge } from "@aurbit/ui/badge";
import { buttonStyles } from "@aurbit/ui/button";
import { EmptyState } from "@aurbit/ui/empty-state";
import { PageHeader } from "@aurbit/ui/page-header";
import {
  ResourceIdentity,
  ResourceList,
  resourceRowStyles,
} from "@aurbit/ui/resource-list";
import Link from "next/link";
import { requirePageUser } from "../../../lib/page-access";
import { listPendingWorkspaceInvitesForUser } from "../../../lib/workspace-invitations";
import { AcceptDashboardInviteForm } from "./accept-dashboard-invite-form";

export const metadata = { title: "Workspaces · Aurbit" };

export default async function OrganizationsPage() {
  const user = await requirePageUser();
  const [memberships, pendingInvites] = await Promise.all([
    db.organizationMember.findMany({
      where: { userId: user.id },
      include: { organization: true },
      orderBy: { organization: { name: "asc" } },
    }),
    listPendingWorkspaceInvitesForUser(user.email),
  ]);

  const createAction = (
    <Link className={buttonStyles()} href="/organizations/new">
      New workspace
    </Link>
  );

  return (
    <section className="mx-auto w-full max-w-5xl" aria-labelledby="page-title">
      <PageHeader
        action={createAction}
        description="Workspaces keep each team and its projects isolated."
        eyebrow="Workspace"
        title="Workspaces"
      />
      {pendingInvites.length ? (
        <section className="mb-10" aria-labelledby="pending-invitations-title">
          <div className="mb-3">
            <h2
              className="text-sm font-semibold text-primary"
              id="pending-invitations-title"
            >
              Pending invitations
            </h2>
            <p className="mt-1 text-sm text-secondary">
              Invitations sent to your verified account email.
            </p>
          </div>
          <ResourceList>
            {pendingInvites.map((invite) => {
              const inviterName =
                invite.invitedBy.name?.trim() || invite.invitedBy.email;
              return (
                <div
                  className={resourceRowStyles(
                    "max-sm:grid max-sm:grid-cols-1",
                  )}
                  key={invite.id}
                >
                  <ResourceIdentity
                    meta={`Invited by ${inviterName} · Expires ${invite.expiresAt.toLocaleDateString()}`}
                    title={invite.organization.name}
                  />
                  <div className="flex shrink-0 items-center gap-3 max-sm:w-full max-sm:justify-between">
                    <Badge>{invite.role.toLowerCase()}</Badge>
                    <AcceptDashboardInviteForm inviteId={invite.id} />
                  </div>
                </div>
              );
            })}
          </ResourceList>
        </section>
      ) : null}

      <h2 className="mb-3 text-sm font-semibold text-primary">
        Your workspaces
      </h2>
      {memberships.length ? (
        <ResourceList>
          {memberships.map(({ organization, role }) => (
            <Link
              className={resourceRowStyles()}
              href={`/organizations/${organization.id}/projects`}
              key={organization.id}
            >
              <ResourceIdentity
                meta={organization.slug}
                title={organization.name}
              />
              <Badge>{role.toLowerCase()}</Badge>
            </Link>
          ))}
        </ResourceList>
      ) : (
        <EmptyState
          action={createAction}
          description="Create your first workspace to start organizing projects and invite your team later."
          title="No workspaces yet"
        />
      )}
    </section>
  );
}
