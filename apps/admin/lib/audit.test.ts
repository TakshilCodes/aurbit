import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  countAudit: vi.fn(),
  findAudit: vi.fn(),
  requireMembership: vi.fn(),
}));

vi.mock("@aurbit/db", () => ({
  db: {
    auditLog: { count: mocks.countAudit, findMany: mocks.findAudit },
  },
}));

vi.mock("./authorization", () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  requireOrganizationMembership: mocks.requireMembership,
}));

import { AuthorizationError } from "./authorization";
import {
  AUDIT_PAGE_SIZE,
  listOrganizationAuditLogs,
  parseAuditPage,
} from "./audit";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireMembership.mockResolvedValue({
    membership: { role: "MEMBER" },
    organization: { id: "organization_1", name: "Workspace" },
  });
  mocks.countAudit.mockResolvedValue(1);
  mocks.findAudit.mockResolvedValue([{ id: "audit_1" }]);
});

describe("workspace audit log", () => {
  it("keeps audit queries and pagination tenant scoped", async () => {
    mocks.countAudit.mockResolvedValue(65);

    const result = await listOrganizationAuditLogs("organization_1", 2);

    expect(result.pagination).toEqual({
      page: 2,
      pageSize: AUDIT_PAGE_SIZE,
      totalCount: 65,
      totalPages: 3,
    });
    expect(mocks.countAudit).toHaveBeenCalledWith({
      where: { organizationId: "organization_1" },
    });
    expect(mocks.findAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "organization_1" },
        skip: AUDIT_PAGE_SIZE,
        take: AUDIT_PAGE_SIZE,
      }),
    );
  });

  it("rejects cross-tenant audit access before querying logs", async () => {
    mocks.requireMembership.mockRejectedValue(new AuthorizationError());

    await expect(
      listOrganizationAuditLogs("organization_other", 1),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(mocks.countAudit).not.toHaveBeenCalled();
    expect(mocks.findAudit).not.toHaveBeenCalled();
  });

  it("normalizes untrusted page values", () => {
    expect(parseAuditPage("2")).toBe(2);
    expect(parseAuditPage("invalid")).toBe(1);
    expect(parseAuditPage(["2"])).toBe(1);
  });
});
