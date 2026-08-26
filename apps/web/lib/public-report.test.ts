import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createReport: vi.fn(),
  resolveProject: vi.fn(),
}));

vi.mock("@aurbit/db", () => ({
  BugReportPriority: { MEDIUM: "MEDIUM" },
  BugReportStatus: { OPEN: "OPEN" },
  db: {
    bugReport: {
      create: mocks.createReport,
    },
  },
}));

vi.mock("./public-project", () => ({
  resolvePublicProjectTarget: mocks.resolveProject,
}));

import { createPublicBugReport } from "./public-report";

const projectKey = "pk_proj_0123456789abcdef01234567";

function validInput() {
  return {
    description: "The save button stops responding after one click.",
    pageUrl: "https://customer.example/dashboard",
    projectKey,
    reporterEmail: "Reporter@Example.com",
    title: "Save button is unresponsive",
    userAgent: "Example Browser",
    viewportHeight: "900",
    viewportWidth: "1440",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveProject.mockResolvedValue({
    organizationId: "organization_1",
    projectId: "project_1",
  });
  mocks.createReport.mockResolvedValue({ id: "report_1" });
});

describe("public bug report submission", () => {
  it("creates a report for a valid public project key", async () => {
    await expect(createPublicBugReport(validInput())).resolves.toEqual({
      message: "Your report was sent to the team.",
      status: "success",
    });
    expect(mocks.createReport).toHaveBeenCalledOnce();
  });

  it("fails safely for an invalid project key", async () => {
    const input = validInput();
    input.projectKey = "project_internal";

    const result = await createPublicBugReport(input);

    expect(result.status).toBe("error");
    expect(mocks.resolveProject).not.toHaveBeenCalled();
    expect(mocks.createReport).not.toHaveBeenCalled();
  });

  it("requires a title and description", async () => {
    const result = await createPublicBugReport({
      ...validInput(),
      description: "",
      title: "",
    });

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.title).toBeDefined();
    expect(result.fieldErrors?.description).toBeDefined();
    expect(mocks.createReport).not.toHaveBeenCalled();
  });

  it("rejects oversized and invalid input", async () => {
    const result = await createPublicBugReport({
      ...validInput(),
      description: "x".repeat(10_001),
      pageUrl: "javascript:alert(1)",
      reporterEmail: "not-an-email",
      title: "x".repeat(161),
      userAgent: "x".repeat(513),
      viewportWidth: "10001",
    });

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.description).toBeDefined();
    expect(result.fieldErrors?.pageUrl).toBeDefined();
    expect(result.fieldErrors?.reporterEmail).toBeDefined();
    expect(result.fieldErrors?.title).toBeDefined();
    expect(result.fieldErrors?.userAgent).toBeDefined();
    expect(result.fieldErrors?.viewportWidth).toBeDefined();
    expect(mocks.createReport).not.toHaveBeenCalled();
  });

  it("does not accept client-supplied project or organization IDs", async () => {
    const result = await createPublicBugReport({
      ...validInput(),
      organizationId: "organization_other",
      projectId: "project_other",
    });

    expect(result.status).toBe("error");
    expect(mocks.resolveProject).not.toHaveBeenCalled();
    expect(mocks.createReport).not.toHaveBeenCalled();
  });

  it("uses the resolved tenant and applies default status and priority", async () => {
    await createPublicBugReport(validInput());

    expect(mocks.createReport).toHaveBeenCalledWith({
      data: {
        description: "The save button stops responding after one click.",
        organizationId: "organization_1",
        pageUrl: "https://customer.example/dashboard",
        priority: "MEDIUM",
        projectId: "project_1",
        reporterEmail: "reporter@example.com",
        status: "OPEN",
        title: "Save button is unresponsive",
        userAgent: "Example Browser",
        viewportHeight: 900,
        viewportWidth: 1440,
      },
      select: { id: true },
    });
  });

  it("keeps reporter email optional", async () => {
    const input = validInput();
    input.reporterEmail = "";

    await expect(createPublicBugReport(input)).resolves.toMatchObject({
      status: "success",
    });
    expect(mocks.createReport).toHaveBeenCalledWith({
      data: {
        description: "The save button stops responding after one click.",
        organizationId: "organization_1",
        pageUrl: "https://customer.example/dashboard",
        priority: "MEDIUM",
        projectId: "project_1",
        reporterEmail: null,
        status: "OPEN",
        title: "Save button is unresponsive",
        userAgent: "Example Browser",
        viewportHeight: 900,
        viewportWidth: 1440,
      },
      select: { id: true },
    });
  });
});
