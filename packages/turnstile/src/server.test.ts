import { describe, expect, it, vi } from "vitest";
import { verifyTurnstileToken } from "./server";

const baseInput = {
  action: "public-report",
  expectedHostname: "aurbit.takshil.in",
  remoteIp: "203.0.113.8",
  secretKey: "secret",
  token: "valid-token",
};

describe("Turnstile server verification", () => {
  it("accepts a valid token for the expected action and hostname", async () => {
    const siteverify = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          action: "public-report",
          hostname: "aurbit.takshil.in",
          success: true,
        }),
        { status: 200 },
      ),
    );

    await expect(verifyTurnstileToken(baseInput, siteverify)).resolves.toBe(
      true,
    );
    expect(siteverify).toHaveBeenCalledOnce();
  });

  it("rejects missing tokens without calling Siteverify", async () => {
    const siteverify = vi.fn<typeof fetch>();

    await expect(
      verifyTurnstileToken({ ...baseInput, token: null }, siteverify),
    ).resolves.toBe(false);
    expect(siteverify).not.toHaveBeenCalled();
  });

  it("rejects action and hostname mismatches", async () => {
    const siteverify = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          action: "login",
          hostname: "admin.aurbit.takshil.in",
          success: true,
        }),
        { status: 200 },
      ),
    );

    await expect(verifyTurnstileToken(baseInput, siteverify)).resolves.toBe(
      false,
    );
  });

  it("allows Cloudflare test keys only on local hostnames", async () => {
    const siteverify = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            metadata: { result_with_testing_key: true },
            success: true,
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(
      verifyTurnstileToken(
        { ...baseInput, expectedHostname: "localhost" },
        siteverify,
      ),
    ).resolves.toBe(true);
    await expect(verifyTurnstileToken(baseInput, siteverify)).resolves.toBe(
      false,
    );
  });
});
