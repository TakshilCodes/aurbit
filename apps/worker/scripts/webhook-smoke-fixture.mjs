import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import {
  createCipheriv,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { createServer } from "node:http";
import process from "node:process";
import { URL } from "node:url";
import { db } from "@aurbit/db";

// Only used by the explicit local integration command, never ordinary unit tests.
export async function createWebhookSmokeFixture(eventId) {
  const databaseUrl = process.env.DATABASE_URL;
  const destination = new URL(databaseUrl || "postgresql://invalid");
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(destination.hostname) ||
    destination.port !== "5433"
  ) {
    throw new Error(
      "Set DATABASE_URL to your local Docker PostgreSQL on port 5433. Remote databases are refused.",
    );
  }
  const organizationId = `webhook-smoke-${randomUUID()}`;
  const projectId = randomUUID();
  const reportId = randomUUID();
  const endpointId = randomUUID();
  const key = randomBytes(32);
  const secret = `whsec_${randomBytes(32).toString("hex")}`;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(`${organizationId}:${endpointId}`));
  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const secretEncrypted = `v1.${iv.toString("base64")}.${ciphertext.toString("base64")}`;
  let received = 0;
  const receiver = createServer(async (request, response) => {
    try {
      assert.equal(request.method, "POST");
      assert.equal(request.url, "/aurbit");
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        assert.ok(size < 16384);
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks);
      const timestamp = request.headers["aurbit-timestamp"];
      const signature = request.headers["aurbit-signature"];
      assert.equal(typeof timestamp, "string");
      assert.match(signature, /^v1=[a-f0-9]{64}$/);
      assert.ok(Math.abs(Date.now() / 1000 - Number(timestamp)) < 300);
      assert.ok(
        timingSafeEqual(
          Buffer.from(signature.slice(3), "hex"),
          createHmac("sha256", secret)
            .update(`${timestamp}.`)
            .update(raw)
            .digest(),
        ),
      );
      const body = JSON.parse(raw.toString("utf8"));
      assert.equal(body.id, eventId);
      assert.equal(request.headers["aurbit-event-id"], eventId);
      assert.equal(body.type, "report.resolved");
      assert.equal(request.headers["aurbit-event-type"], body.type);
      assert.equal(body.data.reportId, reportId);
      assert.equal(body.data.status, "RESOLVED");
      assert.equal(body.data.description, undefined);
      received++;
      response.writeHead(204).end();
    } catch {
      response.writeHead(400).end();
    }
  });
  try {
    await new Promise((resolve, reject) => {
      receiver.once("error", reject);
      receiver.listen(8789, "127.0.0.1", resolve);
    });
    await db.$transaction(async (transaction) => {
      await transaction.organization.create({
        data: {
          id: organizationId,
          slug: organizationId,
          name: "Disposable webhook smoke test",
        },
      });
      await transaction.project.create({
        data: {
          id: projectId,
          organizationId,
          name: "Smoke",
          publicKey: randomUUID(),
        },
      });
      await transaction.bugReport.create({
        data: {
          id: reportId,
          projectId,
          organizationId,
          title: "Local webhook smoke",
          description: "Must not be sent",
          status: "RESOLVED",
        },
      });
      await transaction.webhookEndpoint.create({
        data: {
          id: endpointId,
          organizationId,
          url: "http://127.0.0.1:8789/aurbit",
          events: ["report.resolved"],
          secretEncrypted,
        },
      });
    });
  } catch (error) {
    receiver.close();
    await db.$disconnect();
    throw error;
  }
  return {
    reportId,
    bindings: {
      DATABASE_URL: databaseUrl,
      WEBHOOK_ENCRYPTION_KEY: key.toString("base64"),
      AURBIT_ENV: "local",
      WEBHOOK_LOCAL_TESTING: "true",
    },
    async verify() {
      const delivery = await db.webhookDelivery.findUnique({
        where: {
          webhookEndpointId_eventId: { webhookEndpointId: endpointId, eventId },
        },
      });
      assert.equal(
        delivery?.status,
        "DELIVERED",
        `Delivery result: ${delivery?.lastError ?? "none"}, HTTP ${delivery?.responseStatus ?? "none"}`,
      );
      assert.equal(
        received,
        1,
        "Receiver must validate exactly one signed delivery",
      );
      assert.equal(delivery?.attemptCount, 1);
      assert.equal(delivery?.responseStatus, 204);
      assert.equal(
        await db.webhookDelivery.count({
          where: { webhookEndpointId: endpointId, eventId },
        }),
        1,
      );
    },
    async cleanup() {
      await new Promise((resolve) => receiver.close(resolve));
      // Only the generated fixture workspace is removed; related fixtures cascade.
      await db.organization.deleteMany({
        where: { id: organizationId, slug: organizationId },
      });
      await db.$disconnect();
    },
  };
}
