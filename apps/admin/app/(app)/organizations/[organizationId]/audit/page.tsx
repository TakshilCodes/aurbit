import { Avatar } from "@aurbit/ui/avatar";
import { buttonStyles } from "@aurbit/ui/button";
import { Card } from "@aurbit/ui/card";
import { EmptyState } from "@aurbit/ui/empty-state";
import { PageHeader } from "@aurbit/ui/page-header";
import Link from "next/link";
import { requirePageData } from "../../../../../lib/page-access";
import {
  listOrganizationAuditLogs,
  parseAuditPage,
} from "../../../../../lib/audit";

type PageProps = {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const ACTION_LABELS: Record<string, string> = {
  "workspace.member_added": "Added a workspace member",
  "workspace.member_removed": "Removed a workspace member",
  "workspace.member_role_changed": "Changed a member role",
  "report.status_changed": "Changed report status",
  "report.priority_changed": "Changed report priority",
  "report.assignee_changed": "Changed report assignee",
  "report.internal_note_created": "Added an internal note",
  "report.internal_note_deleted": "Deleted an internal note",
  workspace_invite_created: "Created a workspace invitation",
  workspace_invite_resent: "Resent a workspace invitation",
  workspace_invite_revoked: "Revoked a workspace invitation",
  workspace_invite_accepted: "Accepted a workspace invitation",
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function readableValue(value: unknown) {
  if (value === null) return "None";
  if (typeof value === "string") {
    return value
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/^./, (character) => character.toUpperCase());
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return `${value}`;
  }

  return "Unknown";
}

function metadataSummary(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const values = Object.entries(metadata)
    .filter(
      ([, value]) =>
        value === null ||
        ["string", "number", "boolean"].includes(typeof value),
    )
    .map(
      ([key, value]) =>
        `${key.replaceAll(/([A-Z])/g, " $1")}: ${readableValue(value)}`,
    );
  return values.length ? values.join(" · ") : null;
}

export const metadata = { title: "Audit log · Aurbit" };

export default async function AuditPage({ params, searchParams }: PageProps) {
  const [{ organizationId }, query] = await Promise.all([params, searchParams]);
  const { entries, organization, pagination } = await requirePageData(() =>
    listOrganizationAuditLogs(organizationId, parseAuditPage(query.page)),
  );

  return (
    <section className="mx-auto w-full max-w-5xl" aria-labelledby="page-title">
      <PageHeader
        description="A chronological record of important workspace and report activity."
        eyebrow={organization.name}
        title="Audit log"
      />

      {entries.length ? (
        <Card className="overflow-hidden">
          <ol className="divide-y divide-border">
            {entries.map((entry) => {
              const actorName =
                entry.actor?.name?.trim() ||
                entry.actor?.email ||
                "Former member";
              const details = metadataSummary(entry.metadata);
              return (
                <li
                  className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6"
                  key={entry.id}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar
                      name={actorName}
                      size="sm"
                      src={entry.actor?.image}
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-primary">
                        <span className="font-medium">{actorName}</span>{" "}
                        <span className="text-secondary">
                          {ACTION_LABELS[entry.action] ?? entry.action}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {entry.targetType.replaceAll("_", " ")}
                        {entry.targetId ? ` · ${entry.targetId}` : ""}
                      </p>
                      {details ? (
                        <p className="mt-1.5 wrap-break-word text-xs text-muted">
                          {details}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <time
                    className="text-xs text-muted sm:text-right"
                    dateTime={entry.createdAt.toISOString()}
                  >
                    {formatDate(entry.createdAt)}
                  </time>
                </li>
              );
            })}
          </ol>
        </Card>
      ) : (
        <EmptyState
          description="Important workspace activity will appear here as your team works."
          title="No audit activity yet"
        />
      )}

      {pagination.totalPages > 1 ? (
        <nav
          aria-label="Audit pagination"
          className="mt-6 flex items-center justify-between gap-4"
        >
          {pagination.page > 1 ? (
            <Link
              className={buttonStyles({ variant: "secondary" })}
              href={`/organizations/${organizationId}/audit?page=${pagination.page - 1}`}
            >
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          {pagination.page < pagination.totalPages ? (
            <Link
              className={buttonStyles({ variant: "secondary" })}
              href={`/organizations/${organizationId}/audit?page=${pagination.page + 1}`}
            >
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  );
}
