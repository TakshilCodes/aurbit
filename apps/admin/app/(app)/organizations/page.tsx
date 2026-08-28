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

export const metadata = { title: "Workspaces · Aurbit" };

export default async function OrganizationsPage() {
  const user = await requirePageUser();
  const memberships = await db.organizationMember.findMany({
    where: { userId: user.id },
    include: { organization: true },
    orderBy: { organization: { name: "asc" } },
  });

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
