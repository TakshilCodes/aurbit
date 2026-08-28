import type { BugReportPriority, BugReportStatus } from "@aurbit/db";
import { Badge } from "@aurbit/ui/badge";
import { buttonStyles } from "@aurbit/ui/button";
import { EmptyState } from "@aurbit/ui/empty-state";
import { Input } from "@aurbit/ui/input";
import { PageHeader } from "@aurbit/ui/page-header";
import { Select } from "@aurbit/ui/select";
import Link from "next/link";
import { requirePageData } from "../../../../../lib/page-access";
import {
  listOrganizationReports,
  parseReportListFilters,
  type ReportListFilters,
} from "../../../../../lib/reports";

export const metadata = { title: "Reports · Aurbit" };

type PageProps = {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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

function reportListHref(
  organizationId: string,
  filters: ReportListFilters,
  page: number,
) {
  const parameters = new URLSearchParams();

  if (filters.projectId) parameters.set("project", filters.projectId);
  if (filters.status) parameters.set("status", filters.status);
  if (filters.priority) parameters.set("priority", filters.priority);
  if (filters.search) parameters.set("search", filters.search);
  if (page > 1) parameters.set("page", String(page));

  const query = parameters.toString();
  return `/organizations/${organizationId}/reports${query ? `?${query}` : ""}`;
}

function formatReportDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function ReportsPage({ params, searchParams }: PageProps) {
  const [{ organizationId }, rawSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const requestedFilters = parseReportListFilters(rawSearchParams);
  const { filters, organization, pagination, projects, reports } =
    await requirePageData(() =>
      listOrganizationReports(organizationId, requestedFilters),
    );
  const hasFilters = Boolean(
    filters.projectId || filters.status || filters.priority || filters.search,
  );

  return (
    <section className="mx-auto w-full max-w-7xl" aria-labelledby="page-title">
      <PageHeader
        action={
          <Link
            className={buttonStyles({ variant: "secondary" })}
            href={`/organizations/${organizationId}/projects`}
          >
            View projects
          </Link>
        }
        description="Review bug reports submitted through your hosted forms and installed widgets."
        eyebrow={organization.name}
        title="Reports"
      />

      <form
        action={`/organizations/${organizationId}/reports`}
        className="mb-6 grid gap-3 rounded-xl border border-border bg-surface p-4 lg:grid-cols-[minmax(14rem,1fr)_repeat(3,minmax(10rem,0.55fr))_auto] lg:items-end"
        method="get"
      >
        <label className="grid gap-1.5 text-xs font-medium text-secondary">
          Search title
          <Input
            defaultValue={filters.search ?? ""}
            maxLength={160}
            name="search"
            placeholder="Search reports"
            type="search"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-secondary">
          Project
          <Select defaultValue={filters.projectId ?? ""} name="project">
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-secondary">
          Status
          <Select defaultValue={filters.status ?? ""} name="status">
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-secondary">
          Priority
          <Select defaultValue={filters.priority ?? ""} name="priority">
            <option value="">All priorities</option>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <div className="flex gap-2">
          <button className={buttonStyles()} type="submit">
            Apply
          </button>
          {hasFilters ? (
            <Link
              className={buttonStyles({ variant: "ghost" })}
              href={`/organizations/${organizationId}/reports`}
            >
              Reset
            </Link>
          ) : null}
        </div>
      </form>

      {reports.length ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full min-w-232 border-collapse text-left">
              <thead className="border-b border-border bg-surface-elevated/60">
                <tr className="text-xs font-semibold tracking-wide text-muted uppercase">
                  <th className="px-5 py-3.5">Report</th>
                  <th className="px-4 py-3.5">Project</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Priority</th>
                  <th className="px-4 py-3.5">Reporter</th>
                  <th className="px-5 py-3.5">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reports.map((report) => (
                  <tr
                    className="transition-colors hover:bg-interactive/60"
                    key={report.id}
                  >
                    <td className="max-w-md px-5 py-4">
                      <Link
                        className="font-medium text-primary underline-offset-4 hover:underline"
                        href={`/organizations/${organizationId}/reports/${report.id}`}
                      >
                        {report.title}
                      </Link>
                    </td>
                    <td className="px-4 py-4 text-sm text-secondary">
                      {report.project.name}
                    </td>
                    <td className="px-4 py-4">
                      <Badge>{STATUS_LABELS[report.status]}</Badge>
                    </td>
                    <td className="px-4 py-4">
                      <Badge>{PRIORITY_LABELS[report.priority]}</Badge>
                    </td>
                    <td className="max-w-56 truncate px-4 py-4 text-sm text-secondary">
                      {report.reporterEmail ?? "Not provided"}
                    </td>
                    <td className="px-5 py-4 text-sm whitespace-nowrap text-muted">
                      <time dateTime={report.createdAt.toISOString()}>
                        {formatReportDate(report.createdAt)}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <nav
            aria-label="Report pagination"
            className="mt-5 flex items-center justify-between gap-4"
          >
            <p className="text-sm text-muted">
              {pagination.totalCount === 1
                ? "1 report"
                : `${pagination.totalCount} reports`}{" "}
              · Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              {pagination.page > 1 ? (
                <Link
                  className={buttonStyles({ size: "sm", variant: "secondary" })}
                  href={reportListHref(
                    organizationId,
                    filters,
                    pagination.page - 1,
                  )}
                >
                  Previous
                </Link>
              ) : null}
              {pagination.page < pagination.totalPages ? (
                <Link
                  className={buttonStyles({ size: "sm", variant: "secondary" })}
                  href={reportListHref(
                    organizationId,
                    filters,
                    pagination.page + 1,
                  )}
                >
                  Next
                </Link>
              ) : null}
            </div>
          </nav>
        </>
      ) : (
        <EmptyState
          action={
            hasFilters ? (
              <Link
                className={buttonStyles({ variant: "secondary" })}
                href={`/organizations/${organizationId}/reports`}
              >
                Clear filters
              </Link>
            ) : undefined
          }
          description={
            hasFilters
              ? "No reports match the current project, status, priority, and title filters."
              : "New reports submitted through this workspace's project widgets will appear here."
          }
          title={hasFilters ? "No matching reports" : "No reports yet"}
        />
      )}
    </section>
  );
}
