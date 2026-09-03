import { createObjectStorageFromEnvironment } from "@aurbit/object-storage";
import {
  getPublicReportAttachmentSelectionError,
  PUBLIC_REPORT_ATTACHMENT_POLICY,
  type PublicReportAttachmentContentType,
} from "./public-report-attachment-policy";

const CONTENT_TYPE_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const satisfies Record<PublicReportAttachmentContentType, string>;

export type PreparedPublicReportAttachment = {
  body: ArrayBuffer;
  contentType: PublicReportAttachmentContentType;
  extension: string;
  fileName: string;
  size: number;
};

export type PublicReportAttachmentStore = {
  delete(keys: string[]): Promise<void>;
  put(
    key: string,
    body: ArrayBuffer,
    contentType: PublicReportAttachmentContentType,
  ): Promise<void>;
};

export class PublicReportAttachmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicReportAttachmentValidationError";
  }
}

function isFile(value: FormDataEntryValue): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

function sanitizeFileName(fileName: string, extension: string) {
  const sanitized = [...fileName]
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return character === "/" ||
        character === "\\" ||
        codePoint < 0x20 ||
        codePoint === 0x7f
        ? "_"
        : character;
    })
    .join("")
    .trim()
    .slice(0, PUBLIC_REPORT_ATTACHMENT_POLICY.maxFileNameLength);

  return sanitized || `attachment.${extension}`;
}

function detectedContentType(bytes: Uint8Array) {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png" as const;
  }

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg" as const;
  }

  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp" as const;
  }

  return null;
}

export async function preparePublicReportAttachments(
  entries: readonly FormDataEntryValue[],
): Promise<PreparedPublicReportAttachment[]> {
  const files: File[] = [];

  for (const entry of entries) {
    if (isFile(entry) && entry.size === 0 && entry.name === "") {
      continue;
    }

    if (!isFile(entry)) {
      throw new PublicReportAttachmentValidationError(
        "Attachments must be valid files.",
      );
    }

    files.push(entry);
  }

  const selectionError = getPublicReportAttachmentSelectionError(files);
  if (selectionError) {
    throw new PublicReportAttachmentValidationError(selectionError);
  }

  return Promise.all(
    files.map(async (file) => {
      const body = await file.arrayBuffer();
      const contentType = detectedContentType(new Uint8Array(body));

      if (!contentType || contentType !== file.type) {
        throw new PublicReportAttachmentValidationError(
          "An attachment does not match its declared image type.",
        );
      }

      const extension = CONTENT_TYPE_EXTENSIONS[contentType];

      return {
        body,
        contentType,
        extension,
        fileName: sanitizeFileName(file.name, extension),
        size: file.size,
      };
    }),
  );
}

export function createPublicReportAttachmentObjectKey(
  submissionId: string,
  extension: string,
  objectId: string = crypto.randomUUID(),
) {
  return `bug-reports/${submissionId}/${objectId}.${extension}`;
}

export function getPublicReportAttachmentStore(): PublicReportAttachmentStore {
  return createObjectStorageFromEnvironment();
}
