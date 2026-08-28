import {
  db,
  type BugReportPriority,
  type BugReportStatus,
  type Prisma,
} from "@aurbit/db";
import { requireOrganizationMembership } from "./authorization";

export const REPORTS_PAGE_SIZE = 20;

const REPORT_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
const REPORT_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export type ReportListFilters = {
  page: number;
  priority?: BugReportPriority;
  projectId?: string;
  search?: string;
  status?: BugReportStatus;
};

type ReportSearchParams = Record<string, string | string[] | undefined>;

function singleValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function enumValue<const Values extends readonly string[]>(
  value: string | undefined,
  values: Values,
): Values[number] | undefined {
  return value && values.includes(value)
    ? (value as Values[number])
    : undefined;
}

export function parseReportListFilters(
  searchParams: ReportSearchParams,
): ReportListFilters {
  const rawPage = singleValue(searchParams.page);
  const parsedPage = rawPage && /^\d{1,5}$/.test(rawPage) ? Number(rawPage) : 1;
  const rawProjectId = singleValue(searchParams.project)?.trim();
  const rawSearch = singleValue(searchParams.search)?.trim();

  return {
    page: Math.max(1, parsedPage),
    priority: enumValue(
      singleValue(searchParams.priority),
      REPORT_PRIORITIES,
    ) as BugReportPriority | undefined,
    projectId:
      rawProjectId && rawProjectId.length <= 100 ? rawProjectId : undefined,
    search: rawSearch ? rawSearch.slice(0, 160) : undefined,
    status: enumValue(singleValue(searchParams.status), REPORT_STATUSES) as
      | BugReportStatus
      | undefined,
  };
}

export async function listOrganizationReports(
  organizationId: string,
  requestedFilters: ReportListFilters,
) {
  const { membership, organization } =
    await requireOrganizationMembership(organizationId);
  const where = {
    organizationId,
    ...(requestedFilters.projectId
      ? { projectId: requestedFilters.projectId }
      : {}),
    ...(requestedFilters.status ? { status: requestedFilters.status } : {}),
    ...(requestedFilters.priority
      ? { priority: requestedFilters.priority }
      : {}),
    ...(requestedFilters.search
      ? {
          title: {
            contains: requestedFilters.search,
            mode: "insensitive" as const,
          },
        }
      : {}),
  } satisfies Prisma.BugReportWhereInput;

  const [projects, totalCount] = await Promise.all([
    db.project.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.bugReport.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / REPORTS_PAGE_SIZE));
  const page = Math.min(requestedFilters.page, totalPages);
  const reports = await db.bugReport.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * REPORTS_PAGE_SIZE,
    take: REPORTS_PAGE_SIZE,
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      reporterEmail: true,
      createdAt: true,
      project: { select: { id: true, name: true } },
    },
  });

  return {
    filters: { ...requestedFilters, page },
    membership,
    organization,
    pagination: { page, pageSize: REPORTS_PAGE_SIZE, totalCount, totalPages },
    projects,
    reports,
  };
}

export async function getOrganizationReport(
  organizationId: string,
  reportId: string,
) {
  const { membership, organization } =
    await requireOrganizationMembership(organizationId);
  const report = await db.bugReport.findFirst({
    where: { id: reportId, organizationId },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      reporterEmail: true,
      pageUrl: true,
      userAgent: true,
      viewportWidth: true,
      viewportHeight: true,
      createdAt: true,
      updatedAt: true,
      project: { select: { id: true, name: true } },
      assignee: {
        select: {
          id: true,
          user: { select: { email: true, image: true, name: true } },
        },
      },
      attachments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          fileName: true,
          contentType: true,
          size: true,
          createdAt: true,
        },
      },
      internalNotes: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: {
            select: { id: true, email: true, image: true, name: true },
          },
        },
      },
    },
  });
  const members = report
    ? await db.organizationMember.findMany({
        where: { organizationId },
        orderBy: [{ user: { name: "asc" } }, { user: { email: "asc" } }],
        select: {
          id: true,
          user: { select: { email: true, image: true, name: true } },
        },
      })
    : [];

  return { membership, members, organization, report };
}
