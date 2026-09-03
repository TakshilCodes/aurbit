import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import console from "node:console";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { unstable_readConfig as readConfig } from "wrangler";

const workerRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryDirectory = await mkdtemp(join(tmpdir(), "aurbit-queue-smoke-"));
const workerName = `aurbit-queue-smoke-${process.pid}`;
const config = readConfig({ config: join(workerRoot, "wrangler.jsonc") });
const workerConfigPath = join(temporaryDirectory, "worker.json");
const eventId = randomUUID();
let worker;
let fixture;
let output = "";

async function waitFor(predicate, description) {
  const deadline = Date.now() + 30_000;
  while (!predicate()) {
    if (worker.exitCode !== null) {
      throw new Error(
        `Worker exited during ${description}. Raw runtime output is withheld to avoid exposing bindings.`,
      );
    }
    if (Date.now() > deadline) {
      throw new Error(
        `Timed out waiting for ${description}. Raw runtime output is withheld to avoid exposing bindings.`,
      );
    }
    await delay(100);
  }
}

try {
  if (process.argv.includes("--webhooks")) {
    const { createWebhookSmokeFixture } =
      await import("./webhook-smoke-fixture.mjs");
    fixture = await createWebhookSmokeFixture(eventId);
  }
  await writeFile(
    workerConfigPath,
    JSON.stringify({
      name: workerName,
      main: join(workerRoot, "src/index.ts"),
      compatibility_date: config.compatibility_date,
      compatibility_flags: config.compatibility_flags,
      queues: config.queues,
      vars: {
        AURBIT_ENV: "local",
        DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/unused",
        AUTH_URL: "http://localhost:3001",
        AUTH_RESEND_KEY: "test-not-a-real-key",
        AUTH_EMAIL_FROM: "Aurbit <test@example.com>",
        ...fixture?.bindings,
      },
    }),
  );
  const require = createRequire(import.meta.url);
  worker = spawn(
    process.execPath,
    [
      require.resolve("wrangler"),
      "dev",
      "--config",
      workerConfigPath,
      "--port",
      "0",
      "--inspector-port",
      "0",
      "--persist-to",
      join(temporaryDirectory, "state"),
    ],
    { cwd: workerRoot, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  );
  worker.stdout.on("data", (data) => {
    output += data.toString();
  });
  worker.stderr.on("data", (data) => {
    output += data.toString();
  });
  await waitFor(() => output.includes("Ready on"), "Worker startup");
  console.log("Worker startup passed (real workerd + Prisma import).");

  const readyUrl = output.match(/Ready on (https?:\/\/[^\s]+)/)?.[1];
  assert.ok(readyUrl, "Worker local URL was not reported");

  const invalidResponse = await globalThis.fetch(
    `${readyUrl}/__aurbit/events`,
    {
      body: JSON.stringify({ body: { type: "unsupported" } }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
  );
  assert.equal(invalidResponse.status, 400);

  const response = await globalThis.fetch(`${readyUrl}/__aurbit/events`, {
    body: JSON.stringify({
      body: {
        type: "report.resolved",
        version: 1,
        eventId,
        occurredAt: new Date().toISOString(),
        reportId: fixture?.reportId ?? "queue-smoke-no-email",
      },
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  assert.equal(response.status, 204);

  await waitFor(
    () =>
      output.includes(eventId) &&
      output.includes(
        fixture
          ? "webhook_delivery_completed"
          : "async_event_processing_failed",
      ),
    "Queue consumption",
  );
  if (fixture) {
    await fixture.verify();
    console.log(
      "HTTP producer -> Cloudflare Queue -> Worker -> signed loopback POST -> durable DELIVERED record passed.",
    );
  } else {
    console.log(
      "HTTP producer -> Cloudflare Queue -> Worker retry path passed. No email or webhook sent.",
    );
  }
} catch (error) {
  console.error("Queue smoke test failed:", error);
  process.exitCode = 1;
} finally {
  if (worker && worker.exitCode === null) {
    const exited = new Promise((done) => worker.once("exit", done));
    worker.kill();
    await exited;
  }
  await fixture?.cleanup();
  await rm(temporaryDirectory, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 200,
  });
}
