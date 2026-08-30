import { db, type Prisma } from "@aurbit/db";
import { z } from "zod";
import {
  WEBHOOK_POLICY,
  WebhookConfigurationError,
  webhookInputSchema,
} from "@aurbit/webhooks";
import {
  encryptWebhookSecret,
  generateWebhookSecret,
} from "@aurbit/webhooks/crypto";
import { validateWebhookDestination } from "@aurbit/webhooks/url";
import {
  AuthorizationError,
  assertRole,
  requireOrganizationMembership,
} from "./authorization";
import { AUDIT_ACTIONS, writeAuditLog } from "./audit-log";

const MANAGE_ROLES = ["OWNER", "ADMIN"] as const;
const idSchema = z.string().trim().min(1).max(100);
const mutationSchema = z.discriminatedUnion("action", [
  z
    .object({ action: z.literal("update"), ...webhookInputSchema.shape })
    .strict(),
  z.object({ action: z.literal("toggle"), enabled: z.boolean() }).strict(),
  z.object({ action: z.literal("rotate") }).strict(),
  z.object({ action: z.literal("delete") }).strict(),
]);
const publicEndpointSelect = {
  id: true,
  url: true,
  events: true,
  enabled: true,
  createdAt: true,
} as const;
const historySelect = {
  id: true,
  eventId: true,
  eventType: true,
  status: true,
  attemptCount: true,
  responseStatus: true,
  lastError: true,
  deliveredAt: true,
  createdAt: true,
  updatedAt: true,
  endpoint: { select: { url: true } },
} as const;

async function freshActor(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  userId: string,
) {
  const actor = await transaction.organizationMember.findFirst({
    where: { organizationId, userId },
    select: { role: true },
  });
  if (!actor) throw new AuthorizationError();
  assertRole(actor.role, MANAGE_ROLES);
}

async function validatedUrl(url: string) {
  return validateWebhookDestination(
    url,
    AbortSignal.timeout(WEBHOOK_POLICY.timeoutMs),
    process.env.NODE_ENV === "development" &&
      process.env.WEBHOOK_LOCAL_TESTING === "true",
  );
}

export async function createWorkspaceWebhook(
  organizationId: string,
  input: unknown,
) {
  idSchema.parse(organizationId);
  const { user } = await requireOrganizationMembership(
    organizationId,
    MANAGE_ROLES,
  );
  const parsed = webhookInputSchema.parse(input);
  const url = await validatedUrl(parsed.url);
  const id = crypto.randomUUID();
  const secret = generateWebhookSecret();
  const secretEncrypted = await encryptWebhookSecret(
    secret,
    process.env.WEBHOOK_ENCRYPTION_KEY,
    `${organizationId}:${id}`,
  );
  await db.$transaction(
    async (transaction) => {
      await freshActor(transaction, organizationId, user.id);
      if (
        (await transaction.webhookEndpoint.count({
          where: { organizationId },
        })) >= WEBHOOK_POLICY.maxEndpoints
      ) {
        throw new WebhookConfigurationError(
          "A workspace can have up to 10 webhook endpoints.",
        );
      }
      await transaction.webhookEndpoint.create({
        data: {
          id,
          organizationId,
          url,
          events: parsed.events,
          secretEncrypted,
        },
        select: { id: true },
      });
      await writeAuditLog(transaction, {
        action: AUDIT_ACTIONS.WEBHOOK_CREATED,
        actorUserId: user.id,
        organizationId,
        targetId: id,
        targetType: "webhook_endpoint",
        metadata: { events: parsed.events },
      });
    },
    { isolationLevel: "Serializable" },
  );
  return { secret };
}

export async function mutateWorkspaceWebhook(
  organizationId: string,
  endpointId: string,
  input: unknown,
) {
  idSchema.parse(organizationId);
  idSchema.parse(endpointId);
  const { user } = await requireOrganizationMembership(
    organizationId,
    MANAGE_ROLES,
  );
  const parsed = mutationSchema.parse(input);
  // Resolve tenant ownership before doing DNS work or generating a secret.
  const existing = await db.webhookEndpoint.findFirst({
    where: { id: endpointId, organizationId },
    select: { id: true },
  });
  if (!existing) throw new AuthorizationError();
  const url =
    parsed.action === "update" ? await validatedUrl(parsed.url) : undefined;
  const secret =
    parsed.action === "rotate" ? generateWebhookSecret() : undefined;
  const secretEncrypted = secret
    ? await encryptWebhookSecret(
        secret,
        process.env.WEBHOOK_ENCRYPTION_KEY,
        `${organizationId}:${endpointId}`,
      )
    : undefined;
  await db.$transaction(
    async (transaction) => {
      await freshActor(transaction, organizationId, user.id);
      const current = await transaction.webhookEndpoint.findFirst({
        where: { id: endpointId, organizationId },
        select: { id: true },
      });
      if (!current) throw new AuthorizationError();
      if (parsed.action === "delete") {
        await transaction.webhookEndpoint.delete({
          where: { id: endpointId, organizationId },
        });
      } else {
        await transaction.webhookEndpoint.update({
          where: { id: endpointId, organizationId },
          data:
            parsed.action === "update"
              ? { url, events: parsed.events }
              : parsed.action === "toggle"
                ? { enabled: parsed.enabled }
                : { secretEncrypted },
          select: { id: true },
        });
      }
      await writeAuditLog(transaction, {
        action:
          parsed.action === "update"
            ? AUDIT_ACTIONS.WEBHOOK_UPDATED
            : parsed.action === "toggle"
              ? AUDIT_ACTIONS.WEBHOOK_TOGGLED
              : parsed.action === "rotate"
                ? AUDIT_ACTIONS.WEBHOOK_SECRET_ROTATED
                : AUDIT_ACTIONS.WEBHOOK_DELETED,
        actorUserId: user.id,
        organizationId,
        targetId: endpointId,
        targetType: "webhook_endpoint",
        metadata:
          parsed.action === "toggle"
            ? { enabled: parsed.enabled }
            : parsed.action === "update"
              ? { events: parsed.events }
              : undefined,
      });
    },
    { isolationLevel: "Serializable" },
  );
  return secret ? { secret } : {};
}

export async function listWorkspaceWebhooks(
  organizationId: string,
  rawPage: unknown = "1",
) {
  const { organization } = await requireOrganizationMembership(
    organizationId,
    MANAGE_ROLES,
  );
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(100000)
    .catch(1)
    .parse(rawPage);
  const where = { endpoint: { organizationId } };
  const [endpoints, history, total] = await Promise.all([
    db.webhookEndpoint.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: WEBHOOK_POLICY.maxEndpoints,
      select: {
        ...publicEndpointSelect,
        deliveries: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true },
        },
      },
    }),
    db.webhookDelivery.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * WEBHOOK_POLICY.historyPageSize,
      take: WEBHOOK_POLICY.historyPageSize,
      select: historySelect,
    }),
    db.webhookDelivery.count({ where }),
  ]);
  return {
    organization,
    endpoints,
    history,
    page,
    pages: Math.max(1, Math.ceil(total / WEBHOOK_POLICY.historyPageSize)),
  };
}
