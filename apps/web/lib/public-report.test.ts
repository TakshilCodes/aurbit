import type { PublicReportAttachmentStore } from "./public-report-attachments";
import { PUBLIC_REPORT_ATTACHMENT_POLICY } from "./public-report-attachment-policy";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createReport: vi.fn(),
  protect: vi.fn(),
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

function validRequestContext(): {
  ip: string;
  turnstileToken: FormDataEntryValue | null;
} {
  return {
    ip: "203.0.113.8",
    turnstileToken: "valid-token",
  };
}

function submit(
  input: unknown = validInput(),
  requestContext: {
    attachments?: FormDataEntryValue[];
    ip: string;
    turnstileToken: FormDataEntryValue | null;
  } = validRequestContext(),
  dependencies: {
    attachmentStore?: PublicReportAttachmentStore;
    createId?: () => string;
  } = {},
) {
  return createPublicBugReport(
    input,
    { attachments: [], ...requestContext },
    {
      ...dependencies,
      protect: mocks.protect,
    },
  );
}

function pngFile(name = "screenshot.png") {
  return new File(
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    name,
    { type: "image/png" },
  );
}

function mockAttachmentStore() {
  return {
    delete: vi.fn<PublicReportAttachmentStore["delete"]>(() =>
      Promise.resolve(),
    ),
    put: vi.fn<PublicReportAttachmentStore["put"]>(() => Promise.resolve()),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.protect.mockResolvedValue({ allowed: true });
  mocks.resolveProject.mockResolvedValue({
    organizationId: "organization_1",
    projectId: "project_1",
  });
  mocks.createReport.mockResolvedValue({ id: "report_1" });
});

describe("public bug report submission", () => {
  it("creates a report only after protection passes", async () => {
    await expect(submit()).resolves.toEqual({
      message: "Your report was sent to the team.",
      status: "success",
    });

    expect(mocks.protect).toHaveBeenCalledWith({
      ip: "203.0.113.8",
      projectKey,
      turnstileToken: "valid-token",
    });
    expect(mocks.createReport).toHaveBeenCalledOnce();
    expect(mocks.protect.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.resolveProject.mock.invocationCallOrder[0] ?? 0,
    );
    expect(mocks.resolveProject.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createReport.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it.each([
    [
      "missing Turnstile",
      { allowed: false, reason: "turnstile-invalid" },
      { ip: "203.0.113.8", turnstileToken: null },
      "Security verification failed or expired. Try again.",
    ],
    [
      "invalid Turnstile",
      { allowed: false, reason: "turnstile-invalid" },
      validRequestContext(),
      "Security verification failed or expired. Try again.",
    ],
    [
      "rate limit",
      { allowed: false, reason: "rate-limited" },
      validRequestContext(),
      "Too many reports were sent. Please wait and try again.",
    ],
    [
      "unavailable protection",
      { allowed: false, reason: "unavailable" },
      validRequestContext(),
      "Unable to verify this report right now. Try again.",
    ],
  ] as const)(
    "blocks %s failures before project lookup or creation",
    async (_name, protectionResult, context, expectedMessage) => {
      mocks.protect.mockResolvedValue(protectionResult);

      await expect(submit(validInput(), context)).resolves.toEqual({
        message: expectedMessage,
        status: "error",
      });
      expect(mocks.resolveProject).not.toHaveBeenCalled();
      expect(mocks.createReport).not.toHaveBeenCalled();
    },
  );

  it("fails safely for a malformed project key before protection", async () => {
    const input = validInput();
    input.projectKey = "project_internal";

    const result = await submit(input);

    expect(result.status).toBe("error");
    expect(mocks.protect).not.toHaveBeenCalled();
    expect(mocks.resolveProject).not.toHaveBeenCalled();
    expect(mocks.createReport).not.toHaveBeenCalled();
  });

  it("fails safely when a well-formed project key does not resolve", async () => {
    mocks.resolveProject.mockResolvedValue(null);

    await expect(submit()).resolves.toEqual({
      message: "This report link is invalid or no longer available.",
      status: "error",
    });
    expect(mocks.protect).toHaveBeenCalledOnce();
    expect(mocks.createReport).not.toHaveBeenCalled();
  });

  it("requires a title and description before protection", async () => {
    const result = await submit({
      ...validInput(),
      description: "",
      title: "",
    });

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.title).toBeDefined();
    expect(result.fieldErrors?.description).toBeDefined();
    expect(mocks.protect).not.toHaveBeenCalled();
    expect(mocks.createReport).not.toHaveBeenCalled();
  });

  it("rejects oversized and malformed input before protection", async () => {
    const result = await submit({
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
    expect(mocks.protect).not.toHaveBeenCalled();
    expect(mocks.createReport).not.toHaveBeenCalled();
  });

  it("does not accept client-supplied project or organization IDs", async () => {
    const result = await submit({
      ...validInput(),
      organizationId: "organization_other",
      projectId: "project_other",
    });

    expect(result.status).toBe("error");
    expect(mocks.protect).not.toHaveBeenCalled();
    expect(mocks.resolveProject).not.toHaveBeenCalled();
    expect(mocks.createReport).not.toHaveBeenCalled();
  });

  it("uses the server-resolved tenant and applies report defaults", async () => {
    await submit();

    expect(mocks.createReport).toHaveBeenCalledWith({
      data: {
        attachments: undefined,
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

  it("removes credentials and sensitive URL fragments before storage", async () => {
    await submit({
      ...validInput(),
      pageUrl:
        "https://user:password@customer.example/dashboard?token=secret#private",
    });

    expect(mocks.createReport.mock.calls[0]?.[0]).toMatchObject({
      data: {
        pageUrl: "https://customer.example/dashboard",
      },
    });
  });

  it("keeps reporter email optional", async () => {
    const input = validInput();
    input.reporterEmail = "";

    await expect(submit(input)).resolves.toMatchObject({ status: "success" });
    const createInput = mocks.createReport.mock.calls[0]?.[0] as
      | { data?: { reporterEmail?: unknown } }
      | undefined;
    expect(createInput?.data?.reporterEmail).toBeNull();
  });

  it("stores a valid image and associates its metadata with the report", async () => {
    const store = mockAttachmentStore();
    const ids = ["safe-submission", "safe-object"];

    await expect(
      submit(
        validInput(),
        { ...validRequestContext(), attachments: [pngFile()] },
        { attachmentStore: store, createId: () => ids.shift() ?? "unused" },
      ),
    ).resolves.toMatchObject({ status: "success" });

    expect(store.put).toHaveBeenCalledOnce();
    const [storageKey, body, contentType] = store.put.mock.calls[0] ?? [];
    expect(storageKey).toBe("bug-reports/safe-submission/safe-object.png");
    expect(body).toBeInstanceOf(ArrayBuffer);
    expect(contentType).toBe("image/png");
    expect(mocks.createReport.mock.calls[0]?.[0]).toMatchObject({
      data: {
        attachments: {
          create: [
            {
              contentType: "image/png",
              fileName: "screenshot.png",
              size: 8,
              storageKey: "bug-reports/safe-submission/safe-object.png",
            },
          ],
        },
      },
    });
  });

  it("rejects unsupported attachment MIME types", async () => {
    const store = mockAttachmentStore();
    const file = new File(["plain text"], "notes.txt", { type: "text/plain" });

    const result = await submit(
      validInput(),
      { ...validRequestContext(), attachments: [file] },
      { attachmentStore: store },
    );

    expect(result.fieldErrors?.attachments).toBeDefined();
    expect(store.put).not.toHaveBeenCalled();
    expect(mocks.createReport).not.toHaveBeenCalled();
  });

  it("rejects oversized attachments", async () => {
    const store = mockAttachmentStore();
    const file = new File(
      [new Uint8Array(PUBLIC_REPORT_ATTACHMENT_POLICY.maxFileSizeBytes + 1)],
      "large.png",
      { type: "image/png" },
    );

    const result = await submit(
      validInput(),
      { ...validRequestContext(), attachments: [file] },
      { attachmentStore: store },
    );

    expect(result.fieldErrors?.attachments).toBeDefined();
    expect(store.put).not.toHaveBeenCalled();
    expect(mocks.createReport).not.toHaveBeenCalled();
  });

  it("rejects too many attachments", async () => {
    const store = mockAttachmentStore();
    const attachments = Array.from(
      { length: PUBLIC_REPORT_ATTACHMENT_POLICY.maxCount + 1 },
      (_, index) => pngFile(`screenshot-${index}.png`),
    );

    const result = await submit(
      validInput(),
      { ...validRequestContext(), attachments },
      { attachmentStore: store },
    );

    expect(result.fieldErrors?.attachments).toBeDefined();
    expect(store.put).not.toHaveBeenCalled();
    expect(mocks.createReport).not.toHaveBeenCalled();
  });

  it("does not upload attachments when protection fails", async () => {
    const store = mockAttachmentStore();
    mocks.protect.mockResolvedValue({
      allowed: false,
      reason: "turnstile-invalid",
    });

    await submit(
      validInput(),
      { ...validRequestContext(), attachments: [pngFile()] },
      { attachmentStore: store },
    );

    expect(store.put).not.toHaveBeenCalled();
    expect(mocks.resolveProject).not.toHaveBeenCalled();
    expect(mocks.createReport).not.toHaveBeenCalled();
  });

  it("never uses a user filename in the R2 object key", async () => {
    const store = mockAttachmentStore();
    const ids = ["safe-submission", "safe-object"];

    await submit(
      validInput(),
      {
        ...validRequestContext(),
        attachments: [pngFile("../../private/tenant-secret.png")],
      },
      { attachmentStore: store, createId: () => ids.shift() ?? "unused" },
    );

    const storageKey = store.put.mock.calls[0]?.[0];
    expect(storageKey).toBe("bug-reports/safe-submission/safe-object.png");
    expect(storageKey).not.toContain("private");
    expect(storageKey).not.toContain("tenant-secret");
  });

  it("cleans every attempted object key after a partial upload failure", async () => {
    const store = mockAttachmentStore();
    const ids = ["safe-submission", "first-object", "second-object"];
    store.put
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("R2 unavailable"));

    await expect(
      submit(
        validInput(),
        {
          ...validRequestContext(),
          attachments: [pngFile("first.png"), pngFile("second.png")],
        },
        { attachmentStore: store, createId: () => ids.shift() ?? "unused" },
      ),
    ).resolves.toMatchObject({ status: "error" });

    expect(store.delete).toHaveBeenCalledWith([
      "bug-reports/safe-submission/first-object.png",
      "bug-reports/safe-submission/second-object.png",
    ]);
    expect(mocks.createReport).not.toHaveBeenCalled();
  });

  it("deletes uploaded objects if database creation fails", async () => {
    const store = mockAttachmentStore();
    const ids = ["safe-submission", "safe-object"];
    mocks.createReport.mockRejectedValue(new Error("database unavailable"));

    await expect(
      submit(
        validInput(),
        { ...validRequestContext(), attachments: [pngFile()] },
        { attachmentStore: store, createId: () => ids.shift() ?? "unused" },
      ),
    ).resolves.toMatchObject({ status: "error" });

    expect(store.delete).toHaveBeenCalledWith([
      "bug-reports/safe-submission/safe-object.png",
    ]);
  });
});
