import ipaddr from "ipaddr.js";
import { z } from "zod";
import { WebhookConfigurationError } from "./index";

export function isPublicAddress(value: string) {
  try {
    const address = ipaddr.parse(value);
    // Reject mapped IPv4, translation/tunnel ranges, multicast, reserved and
    // special-use addresses as well as ordinary RFC1918/link-local/loopback.
    return address.range() === "unicast";
  } catch {
    return false;
  }
}

export function normalizeWebhookUrl(value: string, allowLocal = false) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new WebhookConfigurationError("Enter a valid public HTTPS URL.");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(host);
  if (url.username || url.password || url.hash || value.length > 2048) {
    throw new WebhookConfigurationError(
      "Webhook URLs cannot contain credentials or fragments.",
    );
  }
  if (allowLocal && loopback && url.protocol === "http:" && url.port === "8789")
    return url.toString();
  if (
    url.protocol !== "https:" ||
    (url.port && url.port !== "443") ||
    ipaddr.isValid(host.replace(/^\[|\]$/g, "")) ||
    !host.includes(".") ||
    /(^|\.)(localhost|local|internal|lan|home|test|invalid|onion)$/.test(host)
  ) {
    throw new WebhookConfigurationError(
      "Use a public HTTPS hostname on port 443.",
    );
  }
  url.hostname = host;
  return url.toString();
}

const dnsAnswerSchema = z.object({
  Status: z.number(),
  Answer: z
    .array(z.object({ type: z.number(), data: z.string().max(2048) }))
    .max(64)
    .optional(),
});

// Resolve at delivery time, not just when the endpoint is saved. Never follow
// redirects, and reject the whole hostname if either family contains a private IP.
export async function validateWebhookDestination(
  value: string,
  signal: AbortSignal,
  allowLocal = false,
  request: typeof fetch = fetch.bind(globalThis),
) {
  const normalized = normalizeWebhookUrl(value, allowLocal);
  const url = new URL(normalized);
  if (url.protocol === "http:") return normalized;
  const answers = await Promise.all(
    ["A", "AAAA"].map(async (type) => {
      const endpoint = new URL("https://cloudflare-dns.com/dns-query");
      endpoint.searchParams.set("name", url.hostname);
      endpoint.searchParams.set("type", type);
      const response = await request(endpoint, {
        headers: { Accept: "application/dns-json" },
        signal,
        redirect: "error",
      });
      if (!response.ok) throw new Error("dns_unavailable");
      const parsed = dnsAnswerSchema.parse(await response.json());
      if (parsed.Status !== 0) throw new Error("dns_unavailable");
      return (parsed.Answer ?? [])
        .filter((answer) => answer.type === 1 || answer.type === 28)
        .map((answer) => answer.data);
    }),
  );
  const addresses = answers.flat();
  if (
    !addresses.length ||
    addresses.some((address) => !isPublicAddress(address))
  ) {
    throw new WebhookConfigurationError(
      "The webhook hostname must resolve only to public addresses.",
    );
  }
  return normalized;
}
