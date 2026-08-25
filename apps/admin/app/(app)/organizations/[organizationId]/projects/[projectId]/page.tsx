import { Badge } from "@aurbit/ui/badge";
import { Card } from "@aurbit/ui/card";
import { PageHeader } from "@aurbit/ui/page-header";
import { requirePageProject } from "../../../../../../lib/page-access";
import { EditProjectForm } from "../../../../resource-forms";

type PageProps = {
  params: Promise<{ organizationId: string; projectId: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { organizationId, projectId } = await params;
  const { project } = await requirePageProject(projectId, organizationId);
  return { title: `${project.name} · Aurbit` };
}

export default async function ProjectPage({ params }: PageProps) {
  const { organizationId, projectId } = await params;
  const { membership, organization, project } = await requirePageProject(
    projectId,
    organizationId,
  );
  const canManage = membership.role === "OWNER" || membership.role === "ADMIN";

  return (
    <section className="mx-auto w-full max-w-2xl" aria-labelledby="page-title">
      <PageHeader
        description="Project identity and intake configuration for this organization."
        eyebrow={organization.name}
        title={project.name}
      />
      <Card className="mb-6 overflow-hidden">
        <dl className="divide-y divide-border">
          <div className="grid grid-cols-[9rem_minmax(0,1fr)] items-center gap-4 px-6 py-4 max-sm:grid-cols-1 max-sm:gap-1 sm:px-7">
            <dt className="text-xs font-medium text-muted">Public key</dt>
            <dd className="min-w-0 wrap-anywhere">
              <code className="rounded-md border border-border bg-input px-2 py-1 font-mono text-xs text-secondary">
                {project.publicKey}
              </code>
            </dd>
          </div>
          <div className="grid grid-cols-[9rem_minmax(0,1fr)] items-center gap-4 px-6 py-4 max-sm:grid-cols-1 max-sm:gap-1 sm:px-7">
            <dt className="text-xs font-medium text-muted">Your role</dt>
            <dd>
              <Badge>{membership.role.toLowerCase()}</Badge>
            </dd>
          </div>
        </dl>
      </Card>
      {canManage ? (
        <Card className="overflow-hidden">
          <div className="border-b border-border bg-surface px-6 py-5 sm:px-7">
            <h2 className="text-sm font-semibold text-primary">Edit project</h2>
            <p className="mt-1.5 text-sm leading-6 text-secondary">
              Update the project name without changing its public key.
            </p>
          </div>
          <div className="p-6 sm:p-7">
            <EditProjectForm
              name={project.name}
              organizationId={organizationId}
              projectId={projectId}
            />
          </div>
        </Card>
      ) : null}
    </section>
  );
}
