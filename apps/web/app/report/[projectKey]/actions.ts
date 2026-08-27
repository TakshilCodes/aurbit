"use server";

import { createPublicBugReport } from "../../../lib/public-report";
import { getPublicReportClientIp } from "../../../lib/public-report-protection";
import type { PublicReportSubmissionState } from "../../../lib/public-report-state";

export async function submitPublicReportAction(
  projectKey: string,
  _previousState: PublicReportSubmissionState,
  formData: FormData,
): Promise<PublicReportSubmissionState> {
  return createPublicBugReport(
    {
      description: formData.get("description"),
      pageUrl: formData.get("pageUrl"),
      projectKey,
      reporterEmail: formData.get("reporterEmail"),
      title: formData.get("title"),
      userAgent: formData.get("userAgent"),
      viewportHeight: formData.get("viewportHeight"),
      viewportWidth: formData.get("viewportWidth"),
    },
    {
      attachments: formData.getAll("attachments"),
      ip: await getPublicReportClientIp(),
      turnstileToken: formData.get("cf-turnstile-response"),
    },
  );
}
