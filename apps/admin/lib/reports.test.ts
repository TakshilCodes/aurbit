import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  countReports: vi.fn(),
  findProjects: vi.fn(),
  findMembers: vi.fn(),
  findReport: vi.fn(),
  findReports: vi.fn(),
  requireMembership: vi.fn(),
}));

vi.mock("@aurbit/db", () => ({
  db: {
    bugReport: {
      count: mocks.countReports,
      findFirst: mocks.findReport,
      findMany: mocks.findReports,
    },
    organizationMember: { findMany: mocks.findMembers },
    project: { findMany: mocks.findProjects },
  },
}));

vi.mock("./authorization", () => ({
  AuthenticationError: class AuthenticationError extends Error {},
  AuthorizationError: class AuthorizationError extends Error {},
  requireOrganizationMembership: mocks.requireMembership,
}));

import { AuthenticationError, AuthorizationError } from "./authorization";

import {
  getOrganizationReport,
  listOrganizationReports,
  parseReportListFilters,
  REPORTS_PAGE_SIZE,
} from "./reports";

const organizationId = "organization_1";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireMembership.mockResolvedValue({
    membership: { role: "MEMBER" },
    organization: { id: organizationId, name: "Acme" },
  });
  mocks.findMembers.mockResolvedValue([]);
  mocks.findProjects.mockResolvedValue([
    { id: "project_1", name: "Dashboard" },
  ]);
  mocks.countReports.mockResolvedValue(1);
  mocks.findReports.mockResolvedValue([
    {
      id: "report_1",
      title: "Save failed",
      project: { id: "project_1", name: "Dashboard" },
    },
  ]);
  mocks.findReport.mockResolvedValue({
    id: "report_1",
    title: "Save failed",
    project: { id: "project_1", name: "Dashboard" },
    attachments: [],
  });
});

describe("admin report queries", () => {
  it.each(["list", "detail"] as const)(
    "rejects unauthenticated %s access before querying reports",
    async (operation) => {
      mocks.requireMembership.mockRejectedValue(new AuthenticationError());

      const promise =
        operation === "list"
          ? listOrganizationReports(organizationId, { page: 1 })
          : getOrganizationReport(organizationId, "report_1");

      await expect(promise).rejects.toBeInstanceOf(AuthenticationError);
      expect(mocks.findReports).not.toHaveBeenCalled();
      expect(mocks.findReport).not.toHaveBeenCalled();
    },
  );

  it("allows a member to list reports in their organization", async () => {
    const result = await listOrganizationReports(organizationId, { page: 1 });

    expect(result.membership.role).toBe("MEMBER");
    expect(result.reports).toHaveLength(1);
    expect(mocks.requireMembership).toHaveBeenCalledWith(organizationId);
  });

  it("allows a member to view a report in their organization", async () => {
    const result = await getOrganizationReport(organizationId, "report_1");

    expect(result.membership.role).toBe("MEMBER");
    expect(result.report).toMatchObject({ id: "report_1" });
    expect(mocks.findMembers).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId } }),
    );
    expect(mocks.findReport).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "report_1", organizationId } }),
    );
  });

  it("does not query reports when organization membership is missing", async () => {
    mocks.requireMembership.mockRejectedValue(new AuthorizationError());

    await expect(
      listOrganizationReports("organization_other", { page: 1 }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(mocks.countReports).not.toHaveBeenCalled();
    expect(mocks.findReports).not.toHaveBeenCalled();
  });

  it("keeps project, status, priority, and title filters tenant scoped", async () => {
    await listOrganizationReports(organizationId, {
      page: 1,
      priority: "HIGH",
      projectId: "project_other_tenant",
      search: "save",
      status: "OPEN",
    });

    const where = {
      organizationId,
      priority: "HIGH",
      projectId: "project_other_tenant",
      status: "OPEN",
      title: { contains: "save", mode: "insensitive" },
    };
    expect(mocks.countReports).toHaveBeenCalledWith({ where });
    expect(mocks.findReports).toHaveBeenCalledWith(
      expect.objectContaining({ where }),
    );
    expect(mocks.findProjects).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId } }),
    );
  });

  it("keeps pagination scoped and bounded", async () => {
    mocks.countReports.mockResolvedValue(65);

    const result = await listOrganizationReports(organizationId, { page: 3 });

    expect(result.pagination).toEqual({
      page: 3,
      pageSize: REPORTS_PAGE_SIZE,
      totalCount: 65,
      totalPages: 4,
    });
    expect(mocks.findReports).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId },
        skip: REPORTS_PAGE_SIZE * 2,
        take: REPORTS_PAGE_SIZE,
      }),
    );
  });

  it("returns no detail for a cross-tenant report ID", async () => {
    mocks.findReport.mockResolvedValue(null);

    const result = await getOrganizationReport(
      organizationId,
      "report_other_tenant",
    );

    expect(result.report).toBeNull();
    expect(mocks.findReport).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "report_other_tenant", organizationId },
      }),
    );
  });

  it("normalizes untrusted filter values", () => {
    expect(
      parseReportListFilters({
        page: "not-a-page",
        priority: "URGENT",
        project: ["project_1"],
        search: "  save button  ",
        status: "OPEN",
      }),
    ).toEqual({
      page: 1,
      priority: undefined,
      projectId: undefined,
      search: "save button",
      status: "OPEN",
    });
  });
});
