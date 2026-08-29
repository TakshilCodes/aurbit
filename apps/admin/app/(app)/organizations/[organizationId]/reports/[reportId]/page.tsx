import type { BugReportPriority, BugReportStatus } from "@aurbit/db";
import { Badge } from "@aurbit/ui/badge";
import { buttonStyles } from "@aurbit/ui/button";
import { Card } from "@aurbit/ui/card";
import { EmptyState } from "@aurbit/ui/empty-state";
import { PageHeader } from "@aurbit/ui/page-header";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageData } from "../../../../../../lib/page-access";
import { INTERNAL_NOTE_MAX_LENGTH } from "../../../../../../lib/report-triage";
import { getOrganizationReport } from "../../../../../../lib/reports";
import { InternalNotes, ReportTriageControls } from "./triage-panel";

type PageProps = {
  params: Promise<{ organizationId: string; reportId: string }>;
};

const STATUS_LABELS: Record<BugReportStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

const PRIORITY_LABELS: Record<BugReportPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(value);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function safePageUrl(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export default async function ReportDetailPage({ params }: PageProps) {
  const { organizationId, reportId } = await params;
  const { membership, members, organization, report } = await requirePageData(
    () => getOrganizationReport(organizationId, reportId),
  );

  if (!report) notFound();

  const pageUrl = safePageUrl(report.pageUrl);
  const viewport =
    report.viewportWidth && report.viewportHeight
      ? `${report.viewportWidth} × ${report.viewportHeight}`
      : "Not captured";

  return (
    <section className="mx-auto w-full max-w-5xl" aria-labelledby="page-title">
      <PageHeader
        action={
          <Link
            className={buttonStyles({ variant: "secondary" })}
            href={`/organizations/${organizationId}/reports`}
          >
            Back to reports
          </Link>
        }
        description={`Submitted for ${report.project.name}.`}
        eyebrow={organization.name}
        title={report.title}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Badge>{STATUS_LABELS[report.status]}</Badge>
        <Badge>{PRIORITY_LABELS[report.priority]}</Badge>
        <Badge>{report.project.name}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.8fr)]">
        <div className="grid content-start gap-6">
          <Card className="overflow-hidden">
            <div className="border-b border-border bg-surface px-6 py-4">
              <h2 className="text-sm font-semibold text-primary">
                Description
              </h2>
            </div>
            <p className="whitespace-pre-wrap wrap-break-word px-6 py-5 text-sm leading-7 text-secondary">
              {report.description}
            </p>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-border bg-surface px-6 py-4">
              <h2 className="text-sm font-semibold text-primary">
                Attachments
              </h2>
            </div>
            {report.attachments.length ? (
              <ul className="divide-y divide-border">
                {report.attachments.map((attachment) => (
                  <li
                    className="flex items-center justify-between gap-4 px-6 py-4 max-sm:flex-col max-sm:items-start"
                    key={attachment.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-primary">
                        {attachment.fileName}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {attachment.contentType} ·{" "}
                        {formatFileSize(attachment.size)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <a
                        className={buttonStyles({
                          size: "sm",
                          variant: "secondary",
                        })}
                        href={`/api/attachments/${encodeURIComponent(attachment.id)}`}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        View
                      </a>
                      <a
                        className={buttonStyles({
                          size: "sm",
                          variant: "ghost",
                        })}
                        href={`/api/attachments/${encodeURIComponent(attachment.id)}?download=1`}
                      >
                        Download
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                className="m-5 min-h-36"
                description="The reporter did not include any screenshots."
                title="No attachments"
              />
            )}
          </Card>

          <InternalNotes
            canManageAllNotes={membership.role !== "MEMBER"}
            currentUserId={membership.userId}
            initialNotes={report.internalNotes.map((note) => ({
              ...note,
              createdAt: note.createdAt.toISOString(),
            }))}
            maxLength={INTERNAL_NOTE_MAX_LENGTH}
            organizationId={organizationId}
            reportId={report.id}
          />
        </div>

        <div className="grid h-fit content-start gap-6">
          <ReportTriageControls
            initialTriage={{
              assignee: report.assignee,
              priority: report.priority,
              status: report.status,
            }}
            members={members}
            organizationId={organizationId}
            reportId={report.id}
          />

          <Card className="overflow-hidden">
            <div className="border-b border-border bg-surface px-6 py-4">
              <h2 className="text-sm font-semibold text-primary">
                Report context
              </h2>
            </div>
            <dl className="divide-y divide-border">
              <div className="px-6 py-4">
                <dt className="text-xs font-medium text-muted">
                  Reporter email
                </dt>
                <dd className="mt-1.5 wrap-break-word text-sm text-secondary">
                  {report.reporterEmail ?? "Not provided"}
                </dd>
              </div>
              <div className="px-6 py-4">
                <dt className="text-xs font-medium text-muted">Page URL</dt>
                <dd className="mt-1.5 break-all text-sm text-secondary">
                  {pageUrl ? (
                    <a
                      className="underline underline-offset-4 hover:text-primary"
                      href={pageUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {pageUrl}
                    </a>
                  ) : (
                    (report.pageUrl ?? "Not captured")
                  )}
                </dd>
              </div>
              <div className="px-6 py-4">
                <dt className="text-xs font-medium text-muted">Browser</dt>
                <dd className="mt-1.5 wrap-break-word text-sm text-secondary">
                  {report.userAgent ?? "Not captured"}
                </dd>
              </div>
              <div className="px-6 py-4">
                <dt className="text-xs font-medium text-muted">Viewport</dt>
                <dd className="mt-1.5 text-sm text-secondary">{viewport}</dd>
              </div>
              <div className="px-6 py-4">
                <dt className="text-xs font-medium text-muted">Created</dt>
                <dd className="mt-1.5 text-sm text-secondary">
                  <time dateTime={report.createdAt.toISOString()}>
                    {formatDate(report.createdAt)}
                  </time>
                </dd>
              </div>
              <div className="px-6 py-4">
                <dt className="text-xs font-medium text-muted">Updated</dt>
                <dd className="mt-1.5 text-sm text-secondary">
                  <time dateTime={report.updatedAt.toISOString()}>
                    {formatDate(report.updatedAt)}
                  </time>
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </section>
  );
}
