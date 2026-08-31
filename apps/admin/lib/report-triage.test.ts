import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enqueue: vi.fn(),
  createAudit: vi.fn(),
  createNote: vi.fn(),
  deleteNotes: vi.fn(),
  findAssignee: vi.fn(),
  findReport: vi.fn(),
  findNote: vi.fn(),
  requireMembership: vi.fn(),
  transaction: vi.fn(),
  updateReport: vi.fn(),
}));

vi.mock("./async-events", () => ({ enqueueEvent: mocks.enqueue }));

vi.mock("@aurbit/db", () => ({
  db: {
    $transaction: mocks.transaction,
  },
}));

vi.mock("./authorization", () => ({
  AuthenticationError: class AuthenticationError extends Error {},
  requireOrganizationMembership: mocks.requireMembership,
}));

import { AuthenticationError } from "./authorization";
import {
  createInternalNote,
  deleteInternalNote,
  INTERNAL_NOTE_MAX_LENGTH,
  InternalNoteDeletionError,
  InvalidReportAssigneeError,
  updateReportTriage,
} from "./report-triage";

const organizationId = "organization_1";
const reportId = "report_1";

it("emits resolved only after a committed status transition", async () => {
  await updateReportTriage(organizationId, reportId, {
    field: "status",
    value: "RESOLVED",
  });
  expect(mocks.enqueue).toHaveBeenCalledWith({
    type: "report.resolved",
    reportId,
  });
  expect(mocks.createAudit.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.enqueue.mock.invocationCallOrder[0]!,
  );
});

it("emits updated for priority changes, but no event for no-op or assignee", async () => {
  await updateReportTriage(organizationId, reportId, {
    field: "priority",
    value: "HIGH",
  });
  expect(mocks.enqueue).toHaveBeenCalledWith({
    type: "report.updated",
    reportId,
  });
  mocks.enqueue.mockClear();
  await updateReportTriage(organizationId, reportId, {
    field: "status",
    value: "OPEN",
  });
  await updateReportTriage(organizationId, reportId, {
    field: "assignee",
    value: "member_2",
  });
  expect(mocks.enqueue).not.toHaveBeenCalled();
});

it("never enqueues a failed transaction; enqueue failure preserves the committed action", async () => {
  mocks.createAudit.mockRejectedValueOnce(new Error("DB unavailable"));
  await expect(
    updateReportTriage(organizationId, reportId, {
      field: "priority",
      value: "HIGH",
    }),
  ).rejects.toThrow();
  expect(mocks.enqueue).not.toHaveBeenCalled();
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.enqueue.mockRejectedValueOnce(new Error("Queue unavailable"));
  await expect(
    updateReportTriage(organizationId, reportId, {
      field: "priority",
      value: "HIGH",
    }),
  ).resolves.toMatchObject({ id: reportId });
  // The producer owns enqueue failure logs; triage must not log a duplicate.
  expect(log).not.toHaveBeenCalled();
  log.mockRestore();
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enqueue.mockResolvedValue(undefined);
  mocks.requireMembership.mockResolvedValue({
    membership: { role: "MEMBER" },
    user: { id: "user_1" },
  });
  mocks.findReport.mockResolvedValue({
    id: reportId,
    status: "OPEN",
    priority: "MEDIUM",
    assigneeMemberId: null,
    assignee: null,
  });
  mocks.findAssignee.mockResolvedValue({ id: "member_2" });
  mocks.updateReport.mockResolvedValue({
    id: reportId,
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    assigneeMemberId: null,
    assignee: null,
  });
  mocks.findNote.mockResolvedValue({ id: "note_1", authorId: "user_1" });
  mocks.deleteNotes.mockResolvedValue({ count: 1 });
  mocks.createNote.mockResolvedValue({
    id: "note_1",
    body: "Reproduced on the latest release.",
  });
  mocks.createAudit.mockResolvedValue({ id: "audit_1" });
  mocks.transaction.mockImplementation(
    (callback: (transaction: unknown) => unknown) =>
      callback({
        auditLog: { create: mocks.createAudit },
        bugReport: {
          findFirst: mocks.findReport,
          update: mocks.updateReport,
        },
        internalNote: {
          create: mocks.createNote,
          deleteMany: mocks.deleteNotes,
          findFirst: mocks.findNote,
        },
        organizationMember: { findFirst: mocks.findAssignee },
      }),
  );
});

describe("report triage", () => {
  it("changes status and records an audit entry", async () => {
    await updateReportTriage(organizationId, reportId, {
      field: "status",
      value: "IN_PROGRESS",
    });

    expect(mocks.updateReport).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "IN_PROGRESS" } }),
    );
    const auditInput = mocks.createAudit.mock.calls.at(-1)?.[0] as {
      data: Record<string, unknown>;
    };
    expect(auditInput.data).toMatchObject({
      action: "report.status_changed",
      actorUserId: "user_1",
      metadata: { from: "OPEN", to: "IN_PROGRESS" },
      organizationId,
      targetId: reportId,
    });
  });

  it("rejects an invalid status before authorization or mutation", async () => {
    await expect(
      updateReportTriage(organizationId, reportId, {
        field: "status",
        value: "DELETED",
      }),
    ).rejects.toBeDefined();
    expect(mocks.requireMembership).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("changes priority with tenant-scoped audit metadata", async () => {
    await updateReportTriage(organizationId, reportId, {
      field: "priority",
      value: "CRITICAL",
    });

    expect(mocks.updateReport).toHaveBeenCalledWith(
      expect.objectContaining({ data: { priority: "CRITICAL" } }),
    );
    const auditInput = mocks.createAudit.mock.calls.at(-1)?.[0] as {
      data: Record<string, unknown>;
    };
    expect(auditInput.data).toMatchObject({
      action: "report.priority_changed",
      organizationId,
      metadata: { from: "MEDIUM", to: "CRITICAL" },
    });
  });

  it("does not mutate or audit a cross-tenant report", async () => {
    mocks.findReport.mockResolvedValue(null);

    await expect(
      updateReportTriage(organizationId, "report_other", {
        field: "status",
        value: "CLOSED",
      }),
    ).resolves.toBeNull();
    expect(mocks.findReport).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "report_other", organizationId },
      }),
    );
    expect(mocks.updateReport).not.toHaveBeenCalled();
    expect(mocks.createAudit).not.toHaveBeenCalled();
  });

  it("assigns a member from the same workspace and audits the change", async () => {
    await updateReportTriage(organizationId, reportId, {
      field: "assignee",
      value: "member_2",
    });

    expect(mocks.findAssignee).toHaveBeenCalledWith({
      where: { id: "member_2", organizationId },
      select: { id: true },
    });
    expect(mocks.updateReport).toHaveBeenCalledWith(
      expect.objectContaining({ data: { assigneeMemberId: "member_2" } }),
    );
    const auditInput = mocks.createAudit.mock.calls.at(-1)?.[0] as {
      data: Record<string, unknown>;
    };
    expect(auditInput.data).toMatchObject({
      action: "report.assignee_changed",
      metadata: { from: null, to: "member_2" },
    });
  });

  it("rejects an assignee from another workspace", async () => {
    mocks.findAssignee.mockResolvedValue(null);

    await expect(
      updateReportTriage(organizationId, reportId, {
        field: "assignee",
        value: "member_other",
      }),
    ).rejects.toBeInstanceOf(InvalidReportAssigneeError);
    expect(mocks.updateReport).not.toHaveBeenCalled();
    expect(mocks.createAudit).not.toHaveBeenCalled();
  });

  it("clears the assignee without requiring a member lookup", async () => {
    mocks.findReport.mockResolvedValue({
      id: reportId,
      status: "OPEN",
      priority: "MEDIUM",
      assigneeMemberId: "member_2",
      assignee: { id: "member_2" },
    });

    await updateReportTriage(organizationId, reportId, {
      field: "assignee",
      value: null,
    });

    expect(mocks.findAssignee).not.toHaveBeenCalled();
    expect(mocks.updateReport).toHaveBeenCalledWith(
      expect.objectContaining({ data: { assigneeMemberId: null } }),
    );
  });

  it("does not update or audit an unchanged value", async () => {
    await updateReportTriage(organizationId, reportId, {
      field: "status",
      value: "OPEN",
    });

    expect(mocks.updateReport).not.toHaveBeenCalled();
    expect(mocks.createAudit).not.toHaveBeenCalled();
  });

  it("creates a tenant-scoped internal note and audit entry", async () => {
    const result = await createInternalNote(organizationId, reportId, {
      body: "  Reproduced on the latest release.  ",
    });

    expect(result).toMatchObject({ id: "note_1" });
    expect(mocks.createNote).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          authorId: "user_1",
          body: "Reproduced on the latest release.",
          bugReportId: reportId,
          organizationId,
        },
      }),
    );
    const auditInput = mocks.createAudit.mock.calls.at(-1)?.[0] as {
      data: Record<string, unknown>;
    };
    expect(auditInput.data).toMatchObject({
      action: "report.internal_note_created",
      organizationId,
      targetId: "note_1",
      metadata: { reportId },
    });
  });

  it("lets a MEMBER delete their own tenant-scoped note and audits it", async () => {
    await expect(
      deleteInternalNote(organizationId, reportId, "note_1"),
    ).resolves.toEqual({ id: "note_1" });

    expect(mocks.findNote).toHaveBeenCalledWith({
      where: { id: "note_1", organizationId, bugReportId: reportId },
      select: { id: true, authorId: true },
    });
    expect(mocks.deleteNotes).toHaveBeenCalledWith({
      where: { id: "note_1", organizationId, bugReportId: reportId },
    });
    const auditInput = mocks.createAudit.mock.calls.at(-1)?.[0] as {
      data: Record<string, unknown>;
    };
    expect(auditInput.data).toMatchObject({
      action: "report.internal_note_deleted",
      actorUserId: "user_1",
      metadata: { reportId },
      organizationId,
      targetId: "note_1",
    });
  });

  it("prevents a MEMBER from deleting another member's note", async () => {
    mocks.findNote.mockResolvedValue({ id: "note_2", authorId: "user_2" });

    await expect(
      deleteInternalNote(organizationId, reportId, "note_2"),
    ).rejects.toBeInstanceOf(InternalNoteDeletionError);
    expect(mocks.deleteNotes).not.toHaveBeenCalled();
    expect(mocks.createAudit).not.toHaveBeenCalled();
  });

  it("lets an ADMIN delete another member's note", async () => {
    mocks.requireMembership.mockResolvedValue({
      membership: { role: "ADMIN" },
      user: { id: "admin_1" },
    });
    mocks.findNote.mockResolvedValue({ id: "note_2", authorId: "user_2" });

    await expect(
      deleteInternalNote(organizationId, reportId, "note_2"),
    ).resolves.toEqual({ id: "note_2" });
    expect(mocks.deleteNotes).toHaveBeenCalledOnce();
  });

  it("does not delete a cross-tenant or mismatched report note", async () => {
    mocks.findNote.mockResolvedValue(null);

    await expect(
      deleteInternalNote(organizationId, "report_other", "note_1"),
    ).resolves.toBeNull();
    expect(mocks.deleteNotes).not.toHaveBeenCalled();
    expect(mocks.createAudit).not.toHaveBeenCalled();
  });

  it("does not create or audit a note for a cross-tenant report", async () => {
    mocks.findReport.mockResolvedValue(null);

    await expect(
      createInternalNote(organizationId, "report_other", { body: "Private" }),
    ).resolves.toBeNull();
    expect(mocks.createNote).not.toHaveBeenCalled();
    expect(mocks.createAudit).not.toHaveBeenCalled();
  });

  it.each(["update", "note"] as const)(
    "rejects unauthenticated %s mutations",
    async (operation) => {
      mocks.requireMembership.mockRejectedValue(new AuthenticationError());
      const promise =
        operation === "update"
          ? updateReportTriage(organizationId, reportId, {
              field: "status",
              value: "RESOLVED",
            })
          : createInternalNote(organizationId, reportId, { body: "Private" });

      await expect(promise).rejects.toBeInstanceOf(AuthenticationError);
      expect(mocks.transaction).not.toHaveBeenCalled();
    },
  );

  it.each(["", "x".repeat(INTERNAL_NOTE_MAX_LENGTH + 1)])(
    "rejects invalid internal note body before authorization",
    async (body) => {
      await expect(
        createInternalNote(organizationId, reportId, { body }),
      ).rejects.toBeDefined();
      expect(mocks.requireMembership).not.toHaveBeenCalled();
      expect(mocks.createNote).not.toHaveBeenCalled();
    },
  );
});
