import { WebhookConfigurationError } from "./index";

const encoder = new TextEncoder();
function base64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}
function decode(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function encryptionKey(value: string | undefined) {
  try {
    if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value)) throw new Error();
    const bytes = decode(value);
    if (bytes.length !== 32) throw new Error();
    return await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
      "encrypt",
      "decrypt",
    ]);
  } catch {
    throw new WebhookConfigurationError(
      "Webhook encryption is not configured correctly.",
    );
  }
}

export function generateWebhookSecret() {
  return `whsec_${Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function encryptWebhookSecret(
  secret: string,
  key: string | undefined,
  context: string,
) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(context) },
    await encryptionKey(key),
    encoder.encode(secret),
  );
  return `v1.${base64(iv)}.${base64(new Uint8Array(encrypted))}`;
}

export async function decryptWebhookSecret(
  value: string,
  key: string | undefined,
  context: string,
) {
  try {
    const [version, nonce, ciphertext, extra] = value.split(".");
    if (version !== "v1" || !nonce || !ciphertext || extra) throw new Error();
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: decode(nonce),
        additionalData: encoder.encode(context),
      },
      await encryptionKey(key),
      decode(ciphertext),
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new WebhookConfigurationError(
      "Webhook signing secret is unavailable.",
    );
  }
}

export async function signWebhook(
  secret: string,
  timestamp: string,
  rawBody: string,
) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${rawBody}`),
  );
  return `v1=${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
