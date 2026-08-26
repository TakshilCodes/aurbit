"use server";

import { createPublicBugReport } from "../../../lib/public-report";
import type { PublicReportSubmissionState } from "../../../lib/public-report-state";

export async function submitPublicReportAction(
  projectKey: string,
  _previousState: PublicReportSubmissionState,
  formData: FormData,
): Promise<PublicReportSubmissionState> {
  return createPublicBugReport({
    description: formData.get("description"),
    pageUrl: formData.get("pageUrl"),
    projectKey,
    reporterEmail: formData.get("reporterEmail"),
    title: formData.get("title"),
    userAgent: formData.get("userAgent"),
    viewportHeight: formData.get("viewportHeight"),
    viewportWidth: formData.get("viewportWidth"),
  });
}
