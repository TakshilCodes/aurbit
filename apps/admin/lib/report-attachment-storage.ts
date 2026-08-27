import { getCloudflareContext } from "@opennextjs/cloudflare";

type ReportAttachmentObject = {
  body: ReadableStream<Uint8Array>;
};

export type ReportAttachmentBucket = {
  get(key: string): Promise<ReportAttachmentObject | null>;
};

export function getReportAttachmentBucket(): ReportAttachmentBucket {
  const { env } = getCloudflareContext() as unknown as {
    env: { BUG_REPORT_ATTACHMENTS?: ReportAttachmentBucket };
  };
  const bucket = env.BUG_REPORT_ATTACHMENTS;

  if (!bucket) {
    throw new Error(
      "Report attachment storage is not configured. Bind BUG_REPORT_ATTACHMENTS to the private R2 bucket.",
    );
  }

  return bucket;
}
