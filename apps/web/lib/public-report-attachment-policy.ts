export const PUBLIC_REPORT_ATTACHMENT_POLICY = {
  allowedContentTypes: ["image/png", "image/jpeg", "image/webp"],
  maxCount: 3,
  maxFileNameLength: 255,
  maxFileSizeBytes: 5 * 1024 * 1024,
} as const;

export type PublicReportAttachmentContentType =
  (typeof PUBLIC_REPORT_ATTACHMENT_POLICY.allowedContentTypes)[number];

export function getPublicReportAttachmentSelectionError(
  files: readonly Pick<File, "name" | "size" | "type">[],
) {
  if (files.length > PUBLIC_REPORT_ATTACHMENT_POLICY.maxCount) {
    return `Attach up to ${PUBLIC_REPORT_ATTACHMENT_POLICY.maxCount} images.`;
  }

  for (const file of files) {
    if (
      !PUBLIC_REPORT_ATTACHMENT_POLICY.allowedContentTypes.includes(
        file.type as PublicReportAttachmentContentType,
      )
    ) {
      return "Attachments must be PNG, JPEG, or WebP images.";
    }

    if (file.size <= 0) {
      return "Attachments cannot be empty.";
    }

    if (file.size > PUBLIC_REPORT_ATTACHMENT_POLICY.maxFileSizeBytes) {
      return "Each attachment must be 5 MB or smaller.";
    }
  }

  return null;
}
