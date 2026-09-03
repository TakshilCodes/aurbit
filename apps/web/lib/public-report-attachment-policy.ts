export const PUBLIC_REPORT_ATTACHMENT_POLICY = {
  allowedContentTypes: ["image/png", "image/jpeg", "image/webp"],
  maxCount: 3,
  maxFileNameLength: 255,
  maxFileSizeBytes: 4_000_000,
  maxTotalSizeBytes: 4_000_000,
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
      return "Each attachment must be 4 MB or smaller.";
    }
  }

  if (
    files.reduce((total, file) => total + file.size, 0) >
    PUBLIC_REPORT_ATTACHMENT_POLICY.maxTotalSizeBytes
  ) {
    return "Attachments must total 4 MB or less.";
  }

  return null;
}
