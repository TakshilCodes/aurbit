import { createObjectStorageFromEnvironment } from "@aurbit/object-storage";

export type ReportAttachmentBucket = Pick<
  ReturnType<typeof createObjectStorageFromEnvironment>,
  "get"
>;

export function getReportAttachmentBucket(): ReportAttachmentBucket {
  return createObjectStorageFromEnvironment();
}
