import aurbitWordmark from "@aurbit/ui/brand/iconwithtext-transparent";
import { Card } from "@aurbit/ui/card";
import Image from "next/image";
import { notFound } from "next/navigation";
import { resolvePublicProject } from "../../../lib/public-project";
import { PublicReportForm } from "./report-form";

type ReportPageProps = {
  params: Promise<{ projectKey: string }>;
  searchParams: Promise<{ source?: string | string[] }>;
};

function safeSourceUrl(source: string | string[] | undefined) {
  if (typeof source !== "string" || source.length > 2048) {
    return "";
  }

  try {
    const url = new URL(source);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }

    return url.toString();
  } catch {
    return "";
  }
}

export default async function ReportPage({
  params,
  searchParams,
}: ReportPageProps) {
  const [{ projectKey }, { source }] = await Promise.all([
    params,
    searchParams,
  ]);
  const project = await resolvePublicProject(projectKey);

  if (!project) {
    notFound();
  }

  return (
    <main className="grid h-svh place-items-center overflow-y-auto bg-background px-5 py-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-6 sm:py-10">
      <Card className="w-full max-w-xl border-border-strong p-[clamp(1.5rem,5vw,2.5rem)]">
        <header className="mb-10 flex items-center justify-between gap-4">
          <Image
            alt="Aurbit"
            className="h-7 w-auto object-contain"
            priority
            src={aurbitWordmark}
          />
          <span className="text-xs font-semibold tracking-widest text-muted uppercase">
            Bug report
          </span>
        </header>

        <div>
          <p className="mb-3 text-xs font-semibold tracking-[0.08em] text-secondary uppercase">
            Reporting to {project.organizationName}
          </p>
          <h1 className="text-[clamp(1.75rem,5vw,2.25rem)] leading-tight tracking-[-0.035em] text-primary">
            Report an issue with {project.name}
          </h1>
          <p className="mt-4 max-w-lg leading-7 text-secondary">
            Share enough detail for the team to understand and reproduce the
            problem.
          </p>
        </div>

        <PublicReportForm
          pageUrl={safeSourceUrl(source)}
          projectKey={project.projectKey}
        />

        <p className="mt-6 text-center text-xs text-muted">
          Secure reporting powered by Aurbit
        </p>
      </Card>
    </main>
  );
}
