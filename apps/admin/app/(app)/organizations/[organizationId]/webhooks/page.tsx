import Link from "next/link";
import { PageHeader } from "@aurbit/ui/page-header";
import { Badge } from "@aurbit/ui/badge";
import { requirePageData } from "../../../../../lib/page-access";
import { listWorkspaceWebhooks } from "../../../../../lib/webhooks";
import { WebhookControls, WebhookHistoryRefresh } from "./webhook-controls";

export const metadata = { title: "Webhooks · Aurbit" };

export default async function WebhooksPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { organizationId } = await params;
  const { page: requestedPage } = await searchParams;
  const { organization, endpoints, history, page, pages } =
    await requirePageData(() =>
      listWorkspaceWebhooks(organizationId, requestedPage),
    );
  return (
    <section
      className="mx-auto grid w-full max-w-5xl gap-6"
      aria-labelledby="page-title"
    >
      <PageHeader
        title="Webhooks"
        eyebrow={organization.name}
        description="Send signed report events to your own services."
      />
      <div className="grid gap-4 rounded-xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Add endpoint</h2>
        <p className="text-sm text-secondary">
          Public HTTPS URLs only. Up to 10 endpoints per workspace.
        </p>
        <WebhookControls organizationId={organizationId} />
      </div>
      <h2 className="text-lg font-semibold">Endpoints</h2>
      {!endpoints.length ? (
        <p className="text-sm text-secondary">No endpoints yet.</p>
      ) : (
        endpoints.map((endpoint) => (
          <article
            key={endpoint.id}
            className="grid gap-4 rounded-xl border border-border bg-surface p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="min-w-0 break-all text-sm font-medium">
                {endpoint.url}
              </p>
              <Badge>{endpoint.enabled ? "Enabled" : "Disabled"}</Badge>
            </div>
            <p className="text-xs text-secondary">
              {endpoint.events.join(" · ")}
            </p>
            <p className="text-xs text-muted">
              Created {endpoint.createdAt.toISOString().slice(0, 10)} · Last
              delivery:{" "}
              {endpoint.deliveries[0]?.status
                .toLowerCase()
                .replaceAll("_", " ") ?? "none"}
            </p>
            <WebhookControls
              organizationId={organizationId}
              endpoint={endpoint}
            />
          </article>
        ))
      )}
      <div className="grid gap-4">
        <h2 className="text-lg font-semibold">Delivery history</h2>
        <p className="text-sm text-secondary">
          Latest outcome per event and endpoint. Times are UTC.
        </p>
        {!history.length ? (
          <p className="text-sm text-muted">No deliveries yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-secondary">
                <tr>
                  {[
                    "Event / endpoint",
                    "Status",
                    "HTTP",
                    "Attempts",
                    "Last attempt",
                  ].map((heading) => (
                    <th className="p-3 font-medium" key={heading}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((delivery) => (
                  <tr
                    className="border-b border-border last:border-0"
                    key={delivery.id}
                  >
                    <td className="max-w-xs p-3">
                      <p>{delivery.eventType}</p>
                      <p className="break-all text-xs text-muted">
                        {delivery.endpoint.url}
                      </p>
                      <p className="mt-1 break-all text-xs text-muted">
                        {delivery.eventId}
                      </p>
                    </td>
                    <td className="p-3">
                      <Badge>
                        {delivery.status.toLowerCase().replaceAll("_", " ")}
                      </Badge>
                      {delivery.lastError ? (
                        <p className="mt-1 text-xs text-muted">
                          {delivery.lastError.replaceAll("_", " ")}
                        </p>
                      ) : null}
                    </td>
                    <td className="p-3">{delivery.responseStatus ?? "—"}</td>
                    <td className="p-3">{delivery.attemptCount}</td>
                    <td className="whitespace-nowrap p-3 text-xs text-secondary">
                      {delivery.updatedAt
                        .toISOString()
                        .replace("T", " ")
                        .slice(0, 19)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <nav
          aria-label="Delivery history pagination"
          className="flex items-center gap-4 text-sm"
        >
          {page > 1 ? <Link href={`?page=${page - 1}`}>Previous</Link> : null}
          <span className="text-secondary">
            Page {page} of {pages}
          </span>
          {page < pages ? <Link href={`?page=${page + 1}`}>Next</Link> : null}
          <WebhookHistoryRefresh />
        </nav>
      </div>
    </section>
  );
}
