import { db } from "@aurbit/db";
import { buttonStyles } from "@aurbit/ui/button";
import { EmptyState } from "@aurbit/ui/empty-state";
import { PageHeader } from "@aurbit/ui/page-header";
import {
  ResourceIdentity,
  ResourceList,
  resourceRowStyles,
} from "@aurbit/ui/resource-list";
import Link from "next/link";
import { requirePageOrganization } from "../../../../../lib/page-access";

export const metadata = { title: "Projects · Aurbit" };
type PageProps = { params: Promise<{ organizationId: string }> };

export default async function ProjectsPage({ params }: PageProps) {
  const { organizationId } = await params;
  const { membership, organization } =
    await requirePageOrganization(organizationId);
  const projects = await db.project.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
  const canManage = membership.role === "OWNER" || membership.role === "ADMIN";
  const createAction = canManage ? (
    <Link
      className={buttonStyles()}
      href={`/organizations/${organizationId}/projects/new`}
    >
      New project
    </Link>
  ) : undefined;

  return (
    <section className="mx-auto w-full max-w-5xl" aria-labelledby="page-title">
      <PageHeader
        action={createAction}
        description="Projects separate bug intake configuration and public keys within this workspace."
        eyebrow={organization.name}
        title="Projects"
      />
      {projects.length ? (
        <ResourceList>
          {projects.map((project) => (
            <Link
              className={resourceRowStyles()}
              href={`/organizations/${organizationId}/projects/${project.id}`}
              key={project.id}
            >
              <ResourceIdentity meta={project.publicKey} title={project.name} />
              <span className="text-xs font-medium text-muted">
                View project
              </span>
            </Link>
          ))}
        </ResourceList>
      ) : (
        <EmptyState
          action={createAction}
          description={
            canManage
              ? "Create the first project for this workspace. Aurbit will generate its public project key automatically."
              : "A workspace owner or admin can create the first project."
          }
          title="No projects yet"
        />
      )}
    </section>
  );
}
