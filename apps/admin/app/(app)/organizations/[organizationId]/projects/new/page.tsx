import { Card } from "@aurbit/ui/card";
import { PageHeader } from "@aurbit/ui/page-header";
import { PROJECT_MANAGE_ROLES } from "../../../../../../lib/authorization";
import { requirePageOrganization } from "../../../../../../lib/page-access";
import { ProjectForm } from "../../../../resource-forms";

export const metadata = { title: "New project · Aurbit" };
type PageProps = { params: Promise<{ organizationId: string }> };

export default async function NewProjectPage({ params }: PageProps) {
  const { organizationId } = await params;
  const { organization } = await requirePageOrganization(
    organizationId,
    PROJECT_MANAGE_ROLES,
  );

  return (
    <section className="mx-auto w-full max-w-2xl" aria-labelledby="page-title">
      <PageHeader
        description="Create a product boundary for bug intake. Aurbit generates the public project key."
        eyebrow={organization.name}
        title="Create a project"
      />
      <Card className="overflow-hidden">
        <div className="border-b border-border bg-surface px-6 py-5 sm:px-7">
          <h2 className="text-sm font-semibold text-primary">
            Project details
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-secondary">
            Choose a clear name for the website or application receiving
            reports.
          </p>
        </div>
        <div className="p-6 sm:p-7">
          <ProjectForm organizationId={organizationId} />
        </div>
      </Card>
    </section>
  );
}
