import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createNote: vi.fn(),
  updateTriage: vi.fn(),
}));

vi.mock("../../../../../../lib/report-triage", () => ({
  createInternalNote: mocks.createNote,
  InvalidReportAssigneeError: class InvalidReportAssigneeError extends Error {},
  updateReportTriage: mocks.updateTriage,
}));

vi.mock("../../../../../../lib/authorization", () => ({
  AuthenticationError: class AuthenticationError extends Error {},
  AuthorizationError: class AuthorizationError extends Error {},
}));

import { createInternalNoteAction, updateReportTriageAction } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("report triage Server Actions", () => {
  it("returns the authorized triage result", async () => {
    mocks.updateTriage.mockResolvedValue({
      assignee: null,
      priority: "HIGH",
      status: "IN_PROGRESS",
      updatedAt: new Date("2026-08-28T12:00:00.000Z"),
    });

    await expect(
      updateReportTriageAction("organization_1", "report_1", {
        field: "priority",
        value: "HIGH",
      }),
    ).resolves.toEqual({
      report: {
        assignee: null,
        priority: "HIGH",
        status: "IN_PROGRESS",
      },
      success: true,
    });
  });

  it("returns a safe error when the scoped report is unavailable", async () => {
    mocks.updateTriage.mockResolvedValue(null);

    await expect(
      updateReportTriageAction("organization_1", "report_other", {
        field: "status",
        value: "CLOSED",
      }),
    ).resolves.toEqual({
      error: "This report is not available.",
      success: false,
    });
  });

  it("serializes a confirmed internal note for the client", async () => {
    mocks.createNote.mockResolvedValue({
      id: "note_1",
      body: "Confirmed in production.",
      createdAt: new Date("2026-08-28T12:00:00.000Z"),
      author: {
        id: "user_1",
        email: "member@example.com",
        image: null,
        name: "Member",
      },
    });

    await expect(
      createInternalNoteAction("organization_1", "report_1", {
        body: "Confirmed in production.",
      }),
    ).resolves.toMatchObject({
      note: { createdAt: "2026-08-28T12:00:00.000Z", id: "note_1" },
      success: true,
    });
  });

  it("does not expose unexpected server errors", async () => {
    mocks.updateTriage.mockRejectedValue(new Error("database credentials"));

    await expect(
      updateReportTriageAction("organization_1", "report_1", {
        field: "status",
        value: "RESOLVED",
      }),
    ).resolves.toEqual({
      error: "Couldn't update this report. Try again.",
      success: false,
    });
  });
});
