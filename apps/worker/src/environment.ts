import { z } from "zod";

export type WorkerBindings = {
  WEBHOOK_ENCRYPTION_KEY?: string;
  WEBHOOK_LOCAL_TESTING?: string;
  AURBIT_ENV?: string;
  LOCAL_AURBIT_EVENTS?: Queue<unknown>;
  AUTH_EMAIL_FROM?: string;
  AUTH_RESEND_KEY?: string;
  AUTH_URL?: string;
  DATABASE_URL?: string;
};

const workerEmailEnvironmentSchema = z.object({
  AUTH_EMAIL_FROM: z.string().trim().min(1),
  AUTH_RESEND_KEY: z.string().trim().min(1),
  AUTH_URL: z.string().url(),
});

export type WorkerEmailEnvironment = z.infer<
  typeof workerEmailEnvironmentSchema
>;

export function requireWorkerEmailEnvironment(
  environment: WorkerBindings,
): WorkerEmailEnvironment {
  return workerEmailEnvironmentSchema.parse(environment);
}
