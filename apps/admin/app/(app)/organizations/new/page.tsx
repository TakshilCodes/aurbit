import { Card } from "@aurbit/ui/card";
import { PageHeader } from "@aurbit/ui/page-header";
import { OrganizationForm } from "../../resource-forms";

export const metadata = { title: "New organization · Aurbit" };

export default function NewOrganizationPage() {
  return (
    <section className="mx-auto w-full max-w-2xl" aria-labelledby="page-title">
      <PageHeader
        description="Create a private workspace for your company. You will become its owner."
        eyebrow="Get started"
        title="Create an organization"
      />
      <Card className="overflow-hidden">
        <div className="border-b border-border bg-surface px-6 py-5 sm:px-7">
          <h2 className="text-sm font-semibold text-primary">
            Workspace details
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-secondary">
            Use the name your team will recognize. You can manage projects after
            creation.
          </p>
        </div>
        <div className="p-6 sm:p-7">
          <OrganizationForm />
        </div>
      </Card>
      <p className="mt-4 text-xs leading-5 text-muted">
        Organization data and access remain isolated from every other Aurbit
        workspace.
      </p>
    </section>
  );
}
