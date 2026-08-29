import { PageHeader } from "@aurbit/ui/page-header";
import { requirePageData } from "../../../../../lib/page-access";
import { listWorkspaceTeam } from "../../../../../lib/team";
import { TeamClient } from "./team-client";

type PageProps = { params: Promise<{ organizationId: string }> };

export const metadata = { title: "Team · Aurbit" };

export default async function TeamPage({ params }: PageProps) {
  const { organizationId } = await params;
  const { actorUserId, invites, membership, members, organization } =
    await requirePageData(() => listWorkspaceTeam(organizationId));

  return (
    <section className="mx-auto w-full max-w-5xl" aria-labelledby="page-title">
      <PageHeader
        description="Invite people and manage workspace access."
        eyebrow={organization.name}
        title="Team"
      />
      <TeamClient
        actorRole={membership.role}
        actorUserId={actorUserId}
        initialInvites={invites.flatMap((invite) =>
          invite.role === "OWNER"
            ? []
            : [
                {
                  ...invite,
                  role: invite.role,
                  createdAt: invite.createdAt.toISOString(),
                  expiresAt: invite.expiresAt.toISOString(),
                  lastSentAt: invite.lastSentAt.toISOString(),
                },
              ],
        )}
        initialMembers={members.map((member) => ({
          ...member,
          createdAt: member.createdAt.toISOString(),
        }))}
        organizationId={organizationId}
      />
    </section>
  );
}
