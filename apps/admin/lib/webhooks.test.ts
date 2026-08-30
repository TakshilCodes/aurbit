import { beforeEach, describe, expect, it, vi } from "vitest";
import { decryptWebhookSecret } from "@aurbit/webhooks/crypto";

const mocks = vi.hoisted(() => ({
  membership: vi.fn(),
  actor: vi.fn(),
  find: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  audit: vi.fn(),
  list: vi.fn(),
  history: vi.fn(),
  historyCount: vi.fn(),
  transaction: vi.fn(),
  validate: vi.fn(),
}));
vi.mock("../auth", () => ({ auth: vi.fn() }));
vi.mock("@aurbit/db", () => ({
  db: {
    $transaction: mocks.transaction,
    webhookEndpoint: { findFirst: mocks.find, findMany: mocks.list },
    webhookDelivery: { findMany: mocks.history, count: mocks.historyCount },
  },
}));
vi.mock("./authorization", async (original) => {
  const actual = await original<typeof import("./authorization")>();
  return { ...actual, requireOrganizationMembership: mocks.membership };
});
vi.mock("@aurbit/webhooks/url", () => ({
  validateWebhookDestination: mocks.validate,
}));
import { AuthorizationError } from "./authorization";
import {
  createWorkspaceWebhook,
  listWorkspaceWebhooks,
  mutateWorkspaceWebhook,
} from "./webhooks";
const key = btoa("k".repeat(32));
const input = { url: "https://example.com/hook", events: ["report.created"] };
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("WEBHOOK_ENCRYPTION_KEY", key);
  mocks.membership.mockResolvedValue({
    user: { id: "user_1" },
    organization: { id: "org_1", name: "Acme" },
  });
  mocks.actor.mockResolvedValue({ role: "ADMIN" });
  mocks.find.mockResolvedValue({ id: "endpoint_1" });
  mocks.count.mockResolvedValue(0);
  mocks.validate.mockResolvedValue(input.url);
  mocks.list.mockResolvedValue([]);
  mocks.history.mockResolvedValue([]);
  mocks.historyCount.mockResolvedValue(25);
  mocks.transaction.mockImplementation(
    (callback: (transaction: unknown) => unknown) =>
      callback({
        organizationMember: { findFirst: mocks.actor },
        webhookEndpoint: {
          findFirst: mocks.find,
          count: mocks.count,
          create: mocks.create,
          update: mocks.update,
          delete: mocks.remove,
        },
        auditLog: { create: mocks.audit },
      }),
  );
});
describe("workspace webhook authorization", () => {
  it.each(["OWNER", "ADMIN"])(
    "%s can create an encrypted endpoint and audit it",
    async (role) => {
      mocks.actor.mockResolvedValue({ role });
      const result = await createWorkspaceWebhook("org_1", input);
      const call = mocks.create.mock.calls[0]?.[0] as {
        data: { id: string; organizationId: string; secretEncrypted: string };
      };
      expect(call.data.organizationId).toBe("org_1");
      expect(call.data.secretEncrypted).not.toContain(result.secret);
      expect(
        await decryptWebhookSecret(
          call.data.secretEncrypted,
          key,
          `org_1:${call.data.id}`,
        ),
      ).toBe(result.secret);
      expect(mocks.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "webhook.endpoint_created",
            organizationId: "org_1",
          }) as unknown,
        }),
      );
      expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain(
        result.secret,
      );
    },
  );
  it("MEMBER cannot manage, even after the initial authorization check", async () => {
    mocks.actor.mockResolvedValue({ role: "MEMBER" });
    await expect(createWorkspaceWebhook("org_1", input)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it.each(["rotate", "delete", "toggle", "update"])(
    "rejects cross-workspace %s",
    async (action) => {
      mocks.find.mockResolvedValue(null);
      const mutation =
        action === "toggle"
          ? { action, enabled: false }
          : action === "update"
            ? { action, ...input }
            : { action };
      await expect(
        mutateWorkspaceWebhook("other_org", "endpoint_1", mutation),
      ).rejects.toBeInstanceOf(AuthorizationError);
      expect(mocks.find).toHaveBeenCalledWith({
        where: { id: "endpoint_1", organizationId: "other_org" },
        select: { id: true },
      });
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.remove).not.toHaveBeenCalled();
    },
  );
  it("scopes role recheck and mutation; rotation only returns the new secret", async () => {
    const result = await mutateWorkspaceWebhook("org_1", "endpoint_1", {
      action: "rotate",
    });
    expect(result.secret).toMatch(/^whsec_/);
    expect(mocks.actor).toHaveBeenCalledWith({
      where: { organizationId: "org_1", userId: "user_1" },
      select: { role: true },
    });
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "endpoint_1", organizationId: "org_1" },
      }),
    );
    expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain(result.secret);
  });
  it("rejects forged ownership fields and endpoint overflow", async () => {
    await expect(
      createWorkspaceWebhook("org_1", { ...input, organizationId: "other" }),
    ).rejects.toThrow();
    mocks.count.mockResolvedValue(10);
    await expect(createWorkspaceWebhook("org_1", input)).rejects.toThrow(
      "up to 10",
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("requires OWNER/ADMIN for tenant-scoped paginated history without secrets/payload", async () => {
    const result = await listWorkspaceWebhooks("org_1", "2");
    expect(result.pages).toBe(2);
    expect(mocks.membership).toHaveBeenCalledWith("org_1", ["OWNER", "ADMIN"]);
    expect(mocks.history).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { endpoint: { organizationId: "org_1" } },
        take: 20,
        skip: 20,
      }),
    );
    expect(mocks.historyCount).toHaveBeenCalledWith({
      where: { endpoint: { organizationId: "org_1" } },
    });
    expect(JSON.stringify(mocks.list.mock.calls)).not.toContain(
      "secretEncrypted",
    );
    expect(JSON.stringify(mocks.history.mock.calls)).not.toContain("payload");
  });
  it("rejects cross-tenant history before loading records", async () => {
    mocks.membership.mockRejectedValue(new AuthorizationError());
    await expect(listWorkspaceWebhooks("other_org")).rejects.toThrow();
    expect(mocks.history).not.toHaveBeenCalled();
  });
});
