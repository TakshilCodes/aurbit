import { PageHeader } from "@aurbit/ui/page-header";
import { requirePageData } from "../../../../../lib/page-access";
import { listWorkspaceTeam } from "../../../../../lib/team";
import { TeamClient } from "./team-client";

type PageProps = { params: Promise<{ organizationId: string }> };

export const metadata = { title: "Team · Aurbit" };

export default async function TeamPage({ params }: PageProps) {
  const { organizationId } = await params;
  const { actorUserId, membership, members, organization } =
    await requirePageData(() => listWorkspaceTeam(organizationId));

  return (
    <section className="mx-auto w-full max-w-5xl" aria-labelledby="page-title">
      <PageHeader
        description="Manage who can access this workspace and what they can do."
        eyebrow={organization.name}
        title="Team"
      />
      <TeamClient
        actorRole={membership.role}
        actorUserId={actorUserId}
        initialMembers={members.map((member) => ({
          ...member,
          createdAt: member.createdAt.toISOString(),
        }))}
        organizationId={organizationId}
      />
    </section>
  );
}
