"use client";

import { Button } from "@aurbit/ui/button";
import { FormField } from "@aurbit/ui/form-field";
import { useRef, type DragEvent } from "react";
import {
  getPublicReportAttachmentSelectionError,
  PUBLIC_REPORT_ATTACHMENT_POLICY,
} from "../../../lib/public-report-attachment-policy";

function formatFileSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentPicker({
  files,
  onFilesChange,
  serverError,
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
  serverError?: string[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionError = getPublicReportAttachmentSelectionError(files);

  function addFiles(incomingFiles: FileList | File[]) {
    onFilesChange([...files, ...Array.from(incomingFiles)]);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  }

  return (
    <FormField
      error={selectionError ?? serverError}
      hint={`Optional. Up to ${PUBLIC_REPORT_ATTACHMENT_POLICY.maxCount} PNG, JPEG, or WebP images, 5 MB each.`}
      id="report-attachments"
      label="Screenshots"
    >
      <div
        className="rounded-lg border border-dashed border-border-strong bg-input/40 p-4 text-center transition-colors hover:border-secondary"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          accept={PUBLIC_REPORT_ATTACHMENT_POLICY.allowedContentTypes.join(",")}
          className="sr-only"
          id="report-attachments"
          multiple
          onChange={(event) => {
            if (event.target.files) {
              addFiles(event.target.files);
            }
          }}
          ref={inputRef}
          type="file"
        />
        <label
          className="cursor-pointer text-sm font-semibold text-primary"
          htmlFor="report-attachments"
        >
          Choose images
        </label>
        <p className="mt-1 text-xs text-muted">or drop them here</p>
      </div>

      {files.length > 0 ? (
        <ul className="grid gap-2" aria-label="Selected attachments">
          {files.map((file, index) => (
            <li
              className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2"
              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-primary">{file.name}</p>
                <p className="text-xs text-muted">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <Button
                aria-label={`Remove ${file.name}`}
                onClick={() =>
                  onFilesChange(
                    files.filter((_, fileIndex) => fileIndex !== index),
                  )
                }
                size="sm"
                type="button"
                variant="ghost"
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </FormField>
  );
}
