"use client";

import { Alert } from "@aurbit/ui/alert";
import { Button } from "@aurbit/ui/button";
import { FormField } from "@aurbit/ui/form-field";
import { Input } from "@aurbit/ui/input";
import { Textarea } from "@aurbit/ui/textarea";
import { useActionState, useEffect, useMemo, useState } from "react";
import {
  initialPublicReportState,
  type PublicReportSubmissionState,
} from "../../../lib/public-report-state";
import { submitPublicReportAction } from "./actions";

function ReportMessage({ state }: { state: PublicReportSubmissionState }) {
  if (!state.message) {
    return null;
  }

  return (
    <Alert
      role={state.status === "success" ? "status" : "alert"}
      variant={state.status === "success" ? "success" : "error"}
    >
      {state.message}
    </Alert>
  );
}

export function PublicReportForm({
  pageUrl,
  projectKey,
}: {
  pageUrl: string;
  projectKey: string;
}) {
  const action = useMemo(
    () => submitPublicReportAction.bind(null, projectKey),
    [projectKey],
  );
  const [state, formAction, pending] = useActionState(
    action,
    initialPublicReportState,
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [browserContext, setBrowserContext] = useState({
    userAgent: "",
    viewportHeight: "",
    viewportWidth: "",
  });

  useEffect(() => {
    setBrowserContext({
      userAgent: navigator.userAgent.slice(0, 512),
      viewportHeight: String(window.innerHeight),
      viewportWidth: String(window.innerWidth),
    });
  }, []);

  if (state.status === "success") {
    return (
      <div className="mt-10 grid gap-4">
        <Alert role="status" variant="success">
          <div>
            <p className="font-semibold text-primary">Report sent</p>
            <p className="mt-1 text-sm text-success">
              {state.message ?? "Your report was sent to the team."}
            </p>
          </div>
        </Alert>
        <p className="text-sm leading-6 text-secondary">
          You can close this window and continue using the product.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-10 grid gap-5" noValidate>
      <FormField
        error={state.fieldErrors?.title}
        id="report-title"
        label="What went wrong?"
      >
        <Input
          aria-describedby={
            state.fieldErrors?.title ? "report-title-error" : undefined
          }
          aria-invalid={Boolean(state.fieldErrors?.title)}
          autoComplete="off"
          id="report-title"
          maxLength={160}
          name="title"
          onChange={(event) => setTitle(event.target.value)}
          placeholder="The save button stops responding"
          required
          value={title}
        />
      </FormField>

      <FormField
        error={state.fieldErrors?.description}
        hint="Include what you expected and what happened instead."
        id="report-description"
        label="Describe the problem"
      >
        <Textarea
          aria-describedby={
            state.fieldErrors?.description
              ? "report-description-error"
              : "report-description-hint"
          }
          aria-invalid={Boolean(state.fieldErrors?.description)}
          id="report-description"
          maxLength={10_000}
          name="description"
          onChange={(event) => setDescription(event.target.value)}
          placeholder="I clicked Save after editing my profile, but nothing happened…"
          required
          rows={6}
          value={description}
        />
      </FormField>

      <FormField
        error={state.fieldErrors?.reporterEmail}
        hint="Optional. The team may use this to follow up about the report."
        id="report-email"
        label="Your email"
      >
        <Input
          aria-describedby={
            state.fieldErrors?.reporterEmail
              ? "report-email-error"
              : "report-email-hint"
          }
          aria-invalid={Boolean(state.fieldErrors?.reporterEmail)}
          autoComplete="email"
          id="report-email"
          maxLength={254}
          name="reporterEmail"
          onChange={(event) => setReporterEmail(event.target.value)}
          placeholder="you@example.com"
          type="email"
          value={reporterEmail}
        />
      </FormField>

      <input name="pageUrl" type="hidden" value={pageUrl} />
      <input name="userAgent" type="hidden" value={browserContext.userAgent} />
      <input
        name="viewportHeight"
        type="hidden"
        value={browserContext.viewportHeight}
      />
      <input
        name="viewportWidth"
        type="hidden"
        value={browserContext.viewportWidth}
      />

      <ReportMessage state={state} />

      <Button className="w-full" disabled={pending} type="submit">
        {pending ? "Sending report…" : "Send report"}
      </Button>

      <p className="text-center text-xs leading-5 text-muted">
        Browser, viewport, and page context are included to help reproduce the
        issue.
      </p>
    </form>
  );
}
