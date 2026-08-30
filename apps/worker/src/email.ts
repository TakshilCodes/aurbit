import { Resend } from "resend";

export type EmailSendInput = {
  html: string;
  idempotencyKey: string;
  subject: string;
  text: string;
  to: string;
};

export type EmailSendResult = { providerMessageId: string };

export type EmailSender = {
  send(input: EmailSendInput): Promise<EmailSendResult>;
};

type ResendClient = { emails: Pick<Resend["emails"], "send"> };

const permanentResendErrorCodes = new Set([
  "invalid_attachment",
  "invalid_idempotency_key",
  "invalid_idempotent_request",
  "invalid_parameter",
  "method_not_allowed",
  "missing_required_field",
  "not_found",
  "security_error",
  "validation_error",
]);

export class EmailProviderError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super("Transactional email delivery failed.");
    this.name = "EmailProviderError";
  }
}

export function createResendEmailSender(
  { apiKey, from }: { apiKey: string; from: string },
  client: ResendClient = new Resend(apiKey),
): EmailSender {
  return {
    async send(input) {
      let result: Awaited<ReturnType<ResendClient["emails"]["send"]>>;

      try {
        result = await client.emails.send(
          {
            from,
            html: input.html,
            subject: input.subject,
            text: input.text,
            to: input.to,
          },
          { idempotencyKey: input.idempotencyKey },
        );
      } catch {
        throw new EmailProviderError("provider_request_failed", true);
      }

      if (result.error) {
        throw new EmailProviderError(
          result.error.name,
          !permanentResendErrorCodes.has(result.error.name),
        );
      }

      return { providerMessageId: result.data.id };
    },
  };
}
