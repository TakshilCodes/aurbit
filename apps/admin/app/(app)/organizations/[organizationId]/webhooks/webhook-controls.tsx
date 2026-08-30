"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@aurbit/ui/button";
import { Input } from "@aurbit/ui/input";
import { Alert } from "@aurbit/ui/alert";
import { WEBHOOK_EVENTS } from "@aurbit/webhooks";
import {
  createWebhookAction,
  mutateWebhookAction,
  type WebhookActionResult,
} from "./actions";

export function WebhookControls({
  organizationId,
  endpoint,
}: {
  organizationId: string;
  endpoint?: { id: string; url: string; events: string[]; enabled: boolean };
}) {
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const [result, setResult] = useState<WebhookActionResult | null>(null);
  const [editing, setEditing] = useState(!endpoint);
  const router = useRouter();
  function run(operation: () => Promise<WebhookActionResult>) {
    if (busy.current) return;
    busy.current = true;
    setResult(null);
    startTransition(async () => {
      try {
        const next = await operation();
        setResult(next);
        if (next.success) {
          setEditing(!endpoint);
          router.refresh();
        }
      } catch {
        setResult({
          success: false,
          error: "Unable to save. Please try again.",
        });
      } finally {
        busy.current = false;
      }
    });
  }
  return (
    <div className="grid gap-4">
      {result && !result.success ? (
        <Alert role="alert">{result.error}</Alert>
      ) : null}
      {result?.success ? (
        <div
          role="status"
          className="grid gap-2 rounded-lg border border-border p-4 text-sm"
        >
          {result.secret ? (
            <>
              <p>Save this signing secret now. It will not be shown again.</p>
              <code className="break-all select-all">{result.secret}</code>
              <Button size="sm" variant="ghost" onClick={() => setResult(null)}>
                I saved the secret
              </Button>
            </>
          ) : (
            <p>Webhook saved.</p>
          )}
        </div>
      ) : null}
      {editing ? (
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (
              result?.success &&
              result.secret &&
              !window.confirm(
                "Have you saved the signing secret? It will be hidden.",
              )
            )
              return;
            const form = new FormData(event.currentTarget);
            const input = {
              url: form.get("url"),
              events: form.getAll("events"),
            };
            run(() =>
              endpoint
                ? mutateWebhookAction(organizationId, endpoint.id, {
                    action: "update",
                    ...input,
                  })
                : createWebhookAction(organizationId, input),
            );
          }}
        >
          <label className="grid gap-2 text-sm">
            Endpoint URL
            <Input
              name="url"
              type="url"
              required
              maxLength={2048}
              defaultValue={endpoint?.url}
              placeholder="https://example.com/aurbit"
              disabled={pending}
            />
          </label>
          <fieldset disabled={pending} className="grid gap-2">
            <legend className="mb-2 text-sm text-secondary">
              Subscribed events
            </legend>
            {WEBHOOK_EVENTS.map((type) => (
              <label className="flex items-center gap-2 text-sm" key={type}>
                <input
                  className="size-4 accent-white"
                  type="checkbox"
                  name="events"
                  value={type}
                  defaultChecked={
                    endpoint
                      ? endpoint.events.includes(type)
                      : type === "report.created"
                  }
                />
                {type}
              </label>
            ))}
          </fieldset>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving…"
                : endpoint
                  ? "Save changes"
                  : "Create endpoint"}
            </Button>
            {endpoint ? (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}
      {endpoint ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => setEditing(!editing)}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              run(() =>
                mutateWebhookAction(organizationId, endpoint.id, {
                  action: "toggle",
                  enabled: !endpoint.enabled,
                }),
              )
            }
          >
            {endpoint.enabled ? "Disable" : "Enable"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              if (
                window.confirm(
                  "Rotate this signing secret? The old secret stops signing new requests immediately. Update your receiver.",
                )
              )
                run(() =>
                  mutateWebhookAction(organizationId, endpoint.id, {
                    action: "rotate",
                  }),
                );
            }}
          >
            Rotate secret
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-danger"
            disabled={pending}
            onClick={() => {
              if (
                window.confirm(
                  "Delete this webhook and its delivery history? This cannot be undone.",
                )
              )
                run(() =>
                  mutateWebhookAction(organizationId, endpoint.id, {
                    action: "delete",
                  }),
                );
            }}
          >
            Delete
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function WebhookHistoryRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? "Refreshing…" : "Refresh history"}
    </Button>
  );
}
