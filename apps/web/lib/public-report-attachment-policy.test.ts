import { describe, expect, it } from "vitest";
import {
  getPublicReportAttachmentSelectionError,
  PUBLIC_REPORT_ATTACHMENT_POLICY,
} from "./public-report-attachment-policy";

function selectedFile(
  overrides: Partial<Pick<File, "name" | "size" | "type">> = {},
) {
  return {
    name: "screenshot.png",
    size: 8,
    type: "image/png",
    ...overrides,
  };
}

describe("public report attachment selection", () => {
  it("blocks unsupported files instead of silently dropping them", () => {
    expect(
      getPublicReportAttachmentSelectionError([
        selectedFile({ name: "recording.mp4", type: "video/mp4" }),
      ]),
    ).toBe("Attachments must be PNG, JPEG, or WebP images.");
  });

  it("blocks oversized selections and too many files", () => {
    expect(
      getPublicReportAttachmentSelectionError([
        selectedFile({
          size: PUBLIC_REPORT_ATTACHMENT_POLICY.maxFileSizeBytes + 1,
        }),
      ]),
    ).toBe("Each attachment must be 4 MB or smaller.");

    expect(
      getPublicReportAttachmentSelectionError(
        Array.from(
          { length: PUBLIC_REPORT_ATTACHMENT_POLICY.maxCount + 1 },
          () => selectedFile(),
        ),
      ),
    ).toBe("Attach up to 3 images.");
  });

  it("keeps the complete request below Vercel's function body limit", () => {
    expect(
      getPublicReportAttachmentSelectionError([
        selectedFile({ size: 2_100_000 }),
        selectedFile({ size: 2_100_000 }),
      ]),
    ).toBe("Attachments must total 4 MB or less.");
  });
});
