import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanupOldInvites,
  runScheduledMaintenance,
} from "./scheduled-maintenance";

type Invite = {
  id: string;
  expiresAt: Date;
  lastSentAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
};
type Where = {
  [K in Exclude<keyof Invite, "id">]?: { lt: Date } | null;
} & { id?: { in: string[] }; AND?: Where[]; OR?: Where[] };

const store = vi.hoisted(() => ({
  disconnect: vi.fn<() => Promise<void>>(),
  findMany:
    vi.fn<
      (args: { where: Where; take: number }) => Promise<{ id: string }[]>
    >(),
  deleteMany: vi.fn<(args: { where: Where }) => Promise<{ count: number }>>(),
}));
vi.mock("@aurbit/db", () => ({
  db: { organizationInvite: store },
  createPrismaClient: () => ({
    organizationInvite: store,
    $disconnect: store.disconnect,
  }),
}));

const now = new Date("2026-08-30T03:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);
let rows: Invite[];

// Evaluate the small subset of Prisma predicates used here, rather than return
// a fixed success from deleteMany regardless of the cleanup's actual filters.
function matches(invite: Invite, where: Where): boolean {
  if (where.id && !where.id.in.includes(invite.id)) return false;
  if (where.AND && !where.AND.every((part) => matches(invite, part)))
    return false;
  if (where.OR && !where.OR.some((part) => matches(invite, part))) return false;
  return (
    ["expiresAt", "lastSentAt", "acceptedAt", "revokedAt"] as const
  ).every((field) => {
    const condition = where[field];
    if (condition === undefined) return true;
    const value = invite[field];
    return condition === null
      ? value === null
      : value !== null && value < condition.lt;
  });
}

const oldInvite = (overrides: Partial<Invite> = {}): Invite => ({
  id: "old-invite",
  expiresAt: daysAgo(31),
  lastSentAt: daysAgo(38),
  acceptedAt: null,
  revokedAt: null,
  ...overrides,
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  rows = [];
  store.disconnect.mockResolvedValue(undefined);
  store.findMany.mockImplementation(({ where, take }) =>
    Promise.resolve(
      rows
        .filter((row) => matches(row, where))
        .slice(0, take)
        .map(({ id }) => ({ id })),
    ),
  );
  store.deleteMany.mockImplementation(({ where }) => {
    const before = rows.length;
    rows = rows.filter((row) => !matches(row, where));
    return Promise.resolve({ count: before - rows.length });
  });
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("workspace invitation retention", () => {
  it.each([
    ["active", { expiresAt: daysAgo(-1) }],
    ["recently expired", { expiresAt: daysAgo(29) }],
    ["exactly 30 days expired", { expiresAt: daysAgo(30) }],
    ["recently accepted", { acceptedAt: daysAgo(1) }],
    ["recently revoked", { revokedAt: daysAgo(1) }],
    ["recently resent", { lastSentAt: daysAgo(1) }],
    [
      "accepted but unexpired",
      { acceptedAt: daysAgo(31), expiresAt: daysAgo(-1) },
    ],
    [
      "revoked but unexpired",
      { revokedAt: daysAgo(31), expiresAt: daysAgo(-1) },
    ],
  ])("preserves an %s invite", async (_label, overrides) => {
    rows = [oldInvite(overrides)];
    expect(await cleanupOldInvites(now)).toBe(0);
    expect(rows).toHaveLength(1);
    expect(store.deleteMany).not.toHaveBeenCalled();
  });

  it.each([
    ["expired pending", {}],
    ["accepted", { acceptedAt: daysAgo(32) }],
    ["revoked", { revokedAt: daysAgo(32) }],
  ])(
    "deletes an old inactive %s invite and is safe to repeat",
    async (_label, overrides) => {
      rows = [oldInvite(overrides)];
      expect(await cleanupOldInvites(now)).toBe(1);
      expect(await cleanupOldInvites(now)).toBe(0);
      expect(rows).toHaveLength(0);
    },
  );

  it("selects only IDs, bounds each run to 500, and reuses eligibility when deleting", async () => {
    rows = Array.from({ length: 501 }, (_, index) =>
      oldInvite({ id: `invite-${index}` }),
    );
    expect(await cleanupOldInvites(now)).toBe(500);
    expect(rows).toHaveLength(1);
    const selection = store.findMany.mock.calls[0]?.[0];
    expect(selection).toEqual({
      select: { id: true },
      take: 500,
      orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
      where: {
        expiresAt: { lt: daysAgo(30) },
        lastSentAt: { lt: daysAgo(30) },
        AND: [
          { OR: [{ acceptedAt: null }, { acceptedAt: { lt: daysAgo(30) } }] },
          { OR: [{ revokedAt: null }, { revokedAt: { lt: daysAgo(30) } }] },
        ],
      },
    });
    expect(store.deleteMany).toHaveBeenCalledWith({
      where: {
        ...selection?.where,
        id: {
          in: Array.from({ length: 500 }, (_, index) => `invite-${index}`),
        },
      },
    });
  });

  it("does not delete a candidate resent between selection and deletion", async () => {
    rows = [oldInvite()];
    store.findMany.mockImplementationOnce(() => {
      rows = [oldInvite({ expiresAt: daysAgo(-7), lastSentAt: now })];
      return Promise.resolve([{ id: "old-invite" }]);
    });
    expect(await cleanupOldInvites(now)).toBe(0);
    expect(rows).toHaveLength(1);
  });

  it("logs count, job and success without invitation data", async () => {
    rows = [oldInvite()];
    await runScheduledMaintenance(now);
    expect(store.disconnect).toHaveBeenCalledOnce();
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('"deletedCount":1'),
    );
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('"job":"cleanup_old_workspace_invites"'),
    );
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('"success":true'),
    );
    expect(console.info).not.toHaveBeenCalledWith(
      expect.stringContaining("old-invite"),
    );
  });

  it.each(["findMany", "deleteMany"] as const)(
    "logs and propagates %s failure without exposing database details",
    async (operation) => {
      rows = [oldInvite()];
      const failure = new Error("sensitive database error details");
      store[operation].mockRejectedValueOnce(failure);
      await expect(runScheduledMaintenance(now)).rejects.toBe(failure);
      expect(store.disconnect).toHaveBeenCalledOnce();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('"success":false'),
      );
      expect(console.error).not.toHaveBeenCalledWith(
        expect.stringContaining(failure.message),
      );
      expect(console.info).not.toHaveBeenCalled();
    },
  );
});
