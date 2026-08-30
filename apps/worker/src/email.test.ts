import { describe, expect, it, vi } from "vitest";
import { createResendEmailSender, EmailProviderError } from "./email";

type ResendClient = NonNullable<Parameters<typeof createResendEmailSender>[1]>;

function clientWith(response: unknown): ResendClient {
  return {
    emails: {
      send: vi.fn().mockResolvedValue(response),
    },
  } as unknown as ResendClient;
}

const input = {
  html: "<p>Report</p>",
  idempotencyKey: "aurbit/report.created.workspace-admins/delivery_1",
  subject: "New report",
  text: "New report",
  to: "owner@example.com",
};

describe("Resend email sender", () => {
  it("sends with the stable idempotency key and returns the provider ID", async () => {
    const client = clientWith({
      data: { id: "resend_message_1" },
      error: null,
      headers: null,
    });
    const sender = createResendEmailSender(
      { apiKey: "test-key", from: "Aurbit <reports@example.com>" },
      client,
    );

    await expect(sender.send(input)).resolves.toEqual({
      providerMessageId: "resend_message_1",
    });
    expect(client.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "owner@example.com" }),
      { idempotencyKey: input.idempotencyKey },
    );
  });

  it("classifies provider outages as retryable", async () => {
    const sender = createResendEmailSender(
      { apiKey: "test-key", from: "Aurbit <reports@example.com>" },
      clientWith({
        data: null,
        error: {
          message: "Unavailable",
          name: "application_error",
          statusCode: 500,
        },
        headers: null,
      }),
    );

    await expect(sender.send(input)).rejects.toMatchObject({
      code: "application_error",
      retryable: true,
    } satisfies Partial<EmailProviderError>);
  });

  it("classifies invalid-recipient validation failures as permanent", async () => {
    const sender = createResendEmailSender(
      { apiKey: "test-key", from: "Aurbit <reports@example.com>" },
      clientWith({
        data: null,
        error: {
          message: "Invalid recipient",
          name: "validation_error",
          statusCode: 400,
        },
        headers: null,
      }),
    );

    await expect(sender.send(input)).rejects.toMatchObject({
      code: "validation_error",
      retryable: false,
    } satisfies Partial<EmailProviderError>);
  });
});
