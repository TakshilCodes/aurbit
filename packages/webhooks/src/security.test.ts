import { describe, expect, it, vi } from "vitest";
import {
  decryptWebhookSecret,
  encryptWebhookSecret,
  generateWebhookSecret,
  signWebhook,
} from "./crypto";
import {
  isPublicAddress,
  normalizeWebhookUrl,
  validateWebhookDestination,
} from "./url";
import { webhookInputSchema } from "./index";

const key = btoa("k".repeat(32));

describe("webhook secrets and signatures", () => {
  it("matches an independent HMAC SHA256 vector and signs exact body/timestamp", async () => {
    const signature = await signWebhook("secret", "1700000000", "hello");
    expect(signature).toBe(
      "v1=47b1df0ab12338b2685470b0d2b37033add7c3b2bc8172f313e77413f1bb78c8",
    );
    expect(await signWebhook("secret", "1700000001", "hello")).not.toBe(
      signature,
    );
    expect(await signWebhook("secret", "1700000000", "hello ")).not.toBe(
      signature,
    );
    expect(await signWebhook("rotated", "1700000000", "hello")).not.toBe(
      signature,
    );
  });
  it("encrypts random secrets and binds ciphertext to workspace/endpoint", async () => {
    const secret = generateWebhookSecret();
    expect(secret).toMatch(/^whsec_[a-f0-9]{64}$/);
    expect(generateWebhookSecret()).not.toBe(secret);
    const ciphertext = await encryptWebhookSecret(secret, key, "org:endpoint");
    expect(ciphertext).not.toContain(secret);
    expect(await decryptWebhookSecret(ciphertext, key, "org:endpoint")).toBe(
      secret,
    );
    await expect(
      decryptWebhookSecret(ciphertext, key, "other:endpoint"),
    ).rejects.toThrow("unavailable");
    await expect(
      decryptWebhookSecret(ciphertext, btoa("x".repeat(32)), "org:endpoint"),
    ).rejects.toThrow("unavailable");
    await expect(
      decryptWebhookSecret(`${ciphertext}broken`, key, "org:endpoint"),
    ).rejects.toThrow("unavailable");
  });
  it("fails closed on missing encryption configuration", async () => {
    await expect(
      encryptWebhookSecret("secret", undefined, "org:id"),
    ).rejects.toThrow("not configured");
  });
});

describe("webhook destination validation", () => {
  it.each([
    "javascript:alert(1)",
    "data:text/plain,test",
    "file:///etc/passwd",
    "http://example.com",
    "https://localhost",
    "https://app.local",
    "https://internal",
    "https://127.0.0.1",
    "https://2130706433",
    "https://0x7f000001",
    "https://[::1]",
    "https://10.0.0.1",
    "https://169.254.169.254",
    "https://example.com:444",
    "https://user:pass@example.com",
    "https://example.com/#fragment",
    "not a URL",
  ])("rejects unsafe URL %s", (url) => {
    expect(() => normalizeWebhookUrl(url)).toThrow();
  });
  it("normalizes public destinations and permits only explicitly enabled local fixture", () => {
    expect(normalizeWebhookUrl("https://EXAMPLE.com.:443/hook")).toBe(
      "https://example.com/hook",
    );
    expect(normalizeWebhookUrl("http://127.0.0.1:8789/hook", true)).toBe(
      "http://127.0.0.1:8789/hook",
    );
    expect(() => normalizeWebhookUrl("http://127.0.0.1:8789/hook")).toThrow();
    expect(() =>
      normalizeWebhookUrl("http://10.0.0.1:8789/hook", true),
    ).toThrow();
    expect(() => normalizeWebhookUrl("http://localhost:3001", true)).toThrow();
  });
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.1.1.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "64:ff9b::7f00:1",
  ])("rejects special-use resolved address %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });
  it("rejects a hostname with mixed public/private answers", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          Status: 0,
          Answer: [
            { type: 1, data: "8.8.8.8" },
            { type: 1, data: "10.0.0.1" },
          ],
        }),
      ),
    );
    // Each DNS lookup needs its own response body.
    request.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            Status: 0,
            Answer: [
              { type: 1, data: "8.8.8.8" },
              { type: 28, data: "::1" },
            ],
          }),
        ),
      ),
    );
    await expect(
      validateWebhookDestination(
        "https://example.com",
        AbortSignal.timeout(1000),
        false,
        request,
      ),
    ).rejects.toThrow("public addresses");
  });
  it("allows public DNS and fails closed when DNS is unavailable", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              Status: 0,
              Answer: [{ type: 1, data: "8.8.8.8" }],
            }),
          ),
        ),
      );
    await expect(
      validateWebhookDestination(
        "https://example.com",
        AbortSignal.timeout(1000),
        false,
        request,
      ),
    ).resolves.toBe("https://example.com/");
    expect(request).toHaveBeenCalledTimes(2);
    request.mockRejectedValue(new Error("offline"));
    await expect(
      validateWebhookDestination(
        "https://example.com",
        AbortSignal.timeout(1000),
        false,
        request,
      ),
    ).rejects.toThrow();
  });
  it("restricts subscriptions and rejects extra untrusted fields", () => {
    expect(
      webhookInputSchema.parse({
        url: "https://example.com",
        events: ["report.created", "report.created"],
      }).events,
    ).toEqual(["report.created"]);
    expect(
      webhookInputSchema.safeParse({
        url: "https://example.com",
        events: ["user.created"],
      }).success,
    ).toBe(false);
    expect(
      webhookInputSchema.safeParse({
        url: "https://example.com",
        events: [],
        organizationId: "other",
      }).success,
    ).toBe(false);
  });
});
