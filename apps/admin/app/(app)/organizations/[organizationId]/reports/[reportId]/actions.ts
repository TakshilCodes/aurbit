"use server";

import { ZodError } from "zod";
import {
  AuthenticationError,
  AuthorizationError,
} from "../../../../../../lib/authorization";
import {
  createInternalNote,
  InvalidReportAssigneeError,
  updateReportTriage,
} from "../../../../../../lib/report-triage";

function actionError(error: unknown) {
  if (error instanceof AuthenticationError) {
    return "Your session expired. Sign in and try again.";
  }

  if (error instanceof AuthorizationError) {
    return "This report is not available.";
  }

  if (error instanceof InvalidReportAssigneeError) {
    return error.message;
  }

  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Invalid request.";
  }

  return "Couldn't update this report. Try again.";
}

export async function updateReportTriageAction(
  organizationId: string,
  reportId: string,
  input: unknown,
) {
  try {
    const report = await updateReportTriage(organizationId, reportId, input);

    if (!report) {
      return {
        error: "This report is not available.",
        success: false,
      } as const;
    }

    return {
      report: {
        assignee: report.assignee,
        priority: report.priority,
        status: report.status,
      },
      success: true,
    } as const;
  } catch (error) {
    return { error: actionError(error), success: false } as const;
  }
}

export async function createInternalNoteAction(
  organizationId: string,
  reportId: string,
  input: unknown,
) {
  try {
    const note = await createInternalNote(organizationId, reportId, input);

    if (!note) {
      return {
        error: "This report is not available.",
        success: false,
      } as const;
    }

    return {
      note: { ...note, createdAt: note.createdAt.toISOString() },
      success: true,
    } as const;
  } catch (error) {
    return { error: actionError(error), success: false } as const;
  }
}
