export type PublicReportFieldErrors = Partial<
  Record<
    | "attachments"
    | "description"
    | "pageUrl"
    | "projectKey"
    | "reporterEmail"
    | "title"
    | "userAgent"
    | "viewportHeight"
    | "viewportWidth",
    string[]
  >
>;

export type PublicReportSubmissionState = {
  fieldErrors?: PublicReportFieldErrors;
  message?: string;
  status: "idle" | "error" | "success";
};

export const initialPublicReportState: PublicReportSubmissionState = {
  status: "idle",
};
