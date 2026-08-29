"use client";

import { Avatar } from "@aurbit/ui/avatar";
import { Button } from "@aurbit/ui/button";
import { Card } from "@aurbit/ui/card";
import { Select } from "@aurbit/ui/select";
import { Textarea } from "@aurbit/ui/textarea";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createInternalNoteAction,
  deleteInternalNoteAction,
  updateReportTriageAction,
} from "./actions";

type Status = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

type Member = {
  id: string;
  user: { email: string; image: string | null; name: string | null };
};

type Note = {
  id: string;
  body: string;
  createdAt: string;
  author: {
    id: string;
    email: string;
    image: string | null;
    name: string | null;
  };
};

type TriageState = {
  assignee: Member | null;
  priority: Priority;
  status: Status;
};

type TriageInput =
  | { field: "status"; value: Status }
  | { field: "priority"; value: Priority }
  | { field: "assignee"; value: string | null };

const STATUS_OPTIONS: Array<{ label: string; value: Status }> = [
  { label: "Open", value: "OPEN" },
  { label: "In progress", value: "IN_PROGRESS" },
  { label: "Resolved", value: "RESOLVED" },
  { label: "Closed", value: "CLOSED" },
];

const PRIORITY_OPTIONS: Array<{ label: string; value: Priority }> = [
  { label: "Low", value: "LOW" },
  { label: "Medium", value: "MEDIUM" },
  { label: "High", value: "HIGH" },
  { label: "Critical", value: "CRITICAL" },
];

function memberLabel(member: Member) {
  return member.user.name?.trim() || member.user.email;
}

function formatNoteDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ReportTriageControls({
  initialTriage,
  members,
  organizationId,
  reportId,
}: {
  initialTriage: TriageState;
  members: Member[];
  organizationId: string;
  reportId: string;
}) {
  const router = useRouter();
  const [triage, setTriage] = useState(initialTriage);
  const [success, setSuccess] = useState<string | null>(null);
  const mutation = useMutation<
    { report: TriageState },
    Error,
    TriageInput,
    { previous: TriageState }
  >({
    mutationFn: async (input) => {
      const result = await updateReportTriageAction(
        organizationId,
        reportId,
        input,
      );

      if (!result.success) throw new Error(result.error);
      return { report: result.report };
    },
    onMutate: (input) => {
      setSuccess(null);
      const previous = triage;
      setTriage((current) => {
        if (input.field === "status") {
          return { ...current, status: input.value };
        }

        if (input.field === "priority") {
          return { ...current, priority: input.value };
        }

        return {
          ...current,
          assignee: members.find((member) => member.id === input.value) ?? null,
        };
      });
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context) setTriage(context.previous);
    },
    onSuccess: ({ report }) => {
      setTriage(report);
      setSuccess("Report updated.");
    },
    onSettled: () => router.refresh(),
  });
  const assigneeName = triage.assignee
    ? memberLabel(triage.assignee)
    : "Unassigned";

  return (
    <Card className="h-fit overflow-hidden">
      <div className="border-b border-border bg-surface px-6 py-4">
        <h2 className="text-sm font-semibold text-primary">Triage</h2>
        <p className="mt-1 text-xs text-muted">
          Keep the team aligned on ownership and next steps.
        </p>
      </div>
      <div className="grid gap-4 px-6 py-5">
        <label className="grid gap-1.5 text-xs font-medium text-muted">
          Status
          <Select
            aria-label="Report status"
            disabled={mutation.isPending}
            onChange={(event) =>
              mutation.mutate({
                field: "status",
                value: event.target.value as Status,
              })
            }
            value={triage.status}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-muted">
          Priority
          <Select
            aria-label="Report priority"
            disabled={mutation.isPending}
            onChange={(event) =>
              mutation.mutate({
                field: "priority",
                value: event.target.value as Priority,
              })
            }
            value={triage.priority}
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-muted">
          Assignee
          <Select
            aria-label="Report assignee"
            disabled={mutation.isPending}
            onChange={(event) =>
              mutation.mutate({
                field: "assignee",
                value: event.target.value || null,
              })
            }
            value={triage.assignee?.id ?? ""}
          >
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {memberLabel(member)}
              </option>
            ))}
          </Select>
        </label>
        <div className="flex min-h-8 items-center gap-2">
          {triage.assignee ? (
            <Avatar
              name={assigneeName}
              size="sm"
              src={triage.assignee.user.image}
            />
          ) : null}
          <span className="text-sm text-secondary">{assigneeName}</span>
        </div>
        <p
          aria-live="polite"
          className={
            mutation.error ? "text-xs text-danger" : "text-xs text-muted"
          }
        >
          {mutation.isPending
            ? "Saving…"
            : mutation.error?.message || success || "Changes save immediately."}
        </p>
      </div>
    </Card>
  );
}

export function InternalNotes({
  canManageAllNotes,
  currentUserId,
  initialNotes,
  maxLength,
  organizationId,
  reportId,
}: {
  canManageAllNotes: boolean;
  currentUserId: string;
  initialNotes: Note[];
  maxLength: number;
  organizationId: string;
  reportId: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [notes, setNotes] = useState(initialNotes);
  const [success, setSuccess] = useState<string | null>(null);
  const createMutation = useMutation<{ note: Note }, Error, string>({
    mutationFn: async (noteBody) => {
      const result = await createInternalNoteAction(organizationId, reportId, {
        body: noteBody,
      });

      if (!result.success) throw new Error(result.error);
      return { note: result.note };
    },
    onMutate: () => setSuccess(null),
    onSuccess: ({ note }) => {
      setNotes((current) => [...current, note]);
      setBody("");
      setSuccess("Internal note added.");
      router.refresh();
    },
  });
  const deleteMutation = useMutation<{ id: string }, Error, string>({
    mutationFn: async (noteId) => {
      const result = await deleteInternalNoteAction(
        organizationId,
        reportId,
        noteId,
      );

      if (!result.success) throw new Error(result.error);
      return { id: result.note.id };
    },
    onMutate: () => setSuccess(null),
    onSuccess: ({ id }) => {
      setNotes((current) => current.filter((note) => note.id !== id));
      setSuccess("Internal note deleted.");
      router.refresh();
    },
  });
  const error = createMutation.error ?? deleteMutation.error;

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border bg-surface px-6 py-4">
        <h2 className="text-sm font-semibold text-primary">Internal notes</h2>
        <p className="mt-1 text-xs text-muted">
          Private to members of this workspace. Reporters cannot see these
          notes.
        </p>
      </div>
      <div className="grid gap-4 px-6 py-5">
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (body.trim()) createMutation.mutate(body);
          }}
        >
          <Textarea
            aria-label="New internal note"
            disabled={createMutation.isPending}
            maxLength={maxLength}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Add context for your team…"
            value={body}
          />
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted">
              {body.length.toLocaleString()} / {maxLength.toLocaleString()}
            </span>
            <Button
              disabled={createMutation.isPending || !body.trim()}
              size="sm"
              type="submit"
            >
              {createMutation.isPending ? "Adding…" : "Add note"}
            </Button>
          </div>
          <p
            aria-live="polite"
            className={error ? "text-xs text-danger" : "text-xs text-muted"}
          >
            {error?.message || success}
          </p>
        </form>

        {notes.length ? (
          <ol className="divide-y divide-border border-t border-border">
            {notes.map((note) => {
              const authorName = note.author.name?.trim() || note.author.email;
              const canDelete =
                canManageAllNotes || note.author.id === currentUserId;
              return (
                <li className="grid gap-3 py-4" key={note.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar
                        name={authorName}
                        size="sm"
                        src={note.author.image}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-primary">
                          {authorName}
                        </p>
                        <time
                          className="text-xs text-muted"
                          dateTime={note.createdAt}
                        >
                          {formatNoteDate(note.createdAt)}
                        </time>
                      </div>
                    </div>
                    {canDelete ? (
                      <Button
                        aria-label={`Delete note by ${authorName}`}
                        className="text-danger hover:text-danger"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Delete this internal note? This cannot be undone.",
                            )
                          ) {
                            deleteMutation.mutate(note.id);
                          }
                        }}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Delete
                      </Button>
                    ) : null}
                  </div>
                  <p className="whitespace-pre-wrap wrap-break-word text-sm leading-6 text-secondary">
                    {note.body}
                  </p>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="border-t border-border pt-4 text-sm text-muted">
            No internal notes yet.
          </p>
        )}
      </div>
    </Card>
  );
}
