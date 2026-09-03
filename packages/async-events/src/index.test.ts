import { describe, expect, it, vi } from "vitest";
import {
  AurbitEventPublishError,
  createAurbitEvent,
  createEventQueueFromEnvironment,
  enqueueAurbitEvent,
  InvalidAurbitEventError,
  parseAurbitEvent,
} from "./index";

const eventId = "77d8bc7b-f20c-42c3-905a-a6f3211502d7";
const occurredAt = "2026-08-29T12:00:00.000Z";

describe("Aurbit async events", () => {
  it.each(["report.created", "report.resolved"] as const)(
    "accepts a valid %s event",
    (type) => {
      expect(
        parseAurbitEvent({
          eventId,
          occurredAt,
          reportId: "report_1",
          type,
          version: 1,
        }),
      ).toMatchObject({ eventId, reportId: "report_1", type, version: 1 });
    },
  );

  it.each([
    { type: "report.created", version: 2 },
    { type: "report.deleted", version: 1 },
    { type: "report.created", version: 1, reportId: "" },
  ])("rejects malformed or unsupported events", (override) => {
    expect(() =>
      parseAurbitEvent({
        eventId,
        occurredAt,
        reportId: "report_1",
        ...override,
      }),
    ).toThrow(InvalidAurbitEventError);
  });

  it("generates event metadata and preserves explicitly supplied IDs", () => {
    const generated = createAurbitEvent(
      { reportId: "report_1", type: "report.created" },
      { eventId, occurredAt },
    );

    expect(generated).toEqual({
      eventId,
      occurredAt,
      reportId: "report_1",
      type: "report.created",
      version: 1,
    });
  });

  it("sends only the minimal validated event envelope", async () => {
    const queue = { send: vi.fn(() => Promise.resolve()) };

    await expect(
      enqueueAurbitEvent(
        queue,
        { reportId: "report_1", type: "report.created" },
        { eventId, occurredAt },
      ),
    ).resolves.toMatchObject({ eventId, type: "report.created" });
    expect(queue.send).toHaveBeenCalledWith({
      eventId,
      occurredAt,
      reportId: "report_1",
      type: "report.created",
      version: 1,
    });
  });

  it("publishes the validated envelope through the Cloudflare Queues HTTP API", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      );
    const queue = createEventQueueFromEnvironment(
      {
        CLOUDFLARE_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
        CLOUDFLARE_QUEUE_API_TOKEN: "server-only-token",
        CLOUDFLARE_QUEUE_ID: "abcdef0123456789abcdef0123456789",
        NODE_ENV: "production",
      },
      fetcher,
    );
    const event = createAurbitEvent(
      { reportId: "report_1", type: "report.created" },
      { eventId, occurredAt },
    );

    await queue.send(event);

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/queues/abcdef0123456789abcdef0123456789/messages",
      expect.objectContaining({
        body: JSON.stringify({ body: event }),
        method: "POST",
        redirect: "error",
      }),
    );
    const request = fetcher.mock.calls[0]?.[1];
    expect(new Headers(request?.headers).get("authorization")).toBe(
      "Bearer server-only-token",
    );
  });

  it("uses the local-only Worker endpoint during Next development", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    const queue = createEventQueueFromEnvironment(
      { NODE_ENV: "development" },
      fetcher,
    );
    const event = createAurbitEvent(
      { reportId: "report_1", type: "report.updated" },
      { eventId, occurredAt },
    );

    await queue.send(event);

    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:8787/__aurbit/events",
      expect.objectContaining({
        body: JSON.stringify({ body: event }),
        method: "POST",
      }),
    );
    expect(
      new Headers(fetcher.mock.calls[0]?.[1]?.headers).has("authorization"),
    ).toBe(false);
  });

  it("fails safely when Cloudflare rejects a publish", async () => {
    const queue = createEventQueueFromEnvironment(
      {
        CLOUDFLARE_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
        CLOUDFLARE_QUEUE_API_TOKEN: "server-only-token",
        CLOUDFLARE_QUEUE_ID: "abcdef0123456789abcdef0123456789",
        NODE_ENV: "production",
      },
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 403 })),
    );

    await expect(
      queue.send(
        createAurbitEvent(
          { reportId: "report_1", type: "report.created" },
          { eventId, occurredAt },
        ),
      ),
    ).rejects.toBeInstanceOf(AurbitEventPublishError);
  });
  it("rejects an unsuccessful Cloudflare API envelope", async () => {
    const queue = createEventQueueFromEnvironment(
      {
        CLOUDFLARE_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
        CLOUDFLARE_QUEUE_API_TOKEN: "server-only-token",
        CLOUDFLARE_QUEUE_ID: "abcdef0123456789abcdef0123456789",
        NODE_ENV: "production",
      },
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(JSON.stringify({ success: false }), { status: 200 }),
        ),
    );

    await expect(
      queue.send(
        createAurbitEvent(
          { reportId: "report_1", type: "report.created" },
          { eventId, occurredAt },
        ),
      ),
    ).rejects.toBeInstanceOf(AurbitEventPublishError);
  });
});
