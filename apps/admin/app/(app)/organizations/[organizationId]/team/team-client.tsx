"use client";

import { Avatar } from "@aurbit/ui/avatar";
import { Button } from "@aurbit/ui/button";
import { Card } from "@aurbit/ui/card";
import { Input } from "@aurbit/ui/input";
import { Select } from "@aurbit/ui/select";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  addWorkspaceMemberAction,
  removeWorkspaceMemberAction,
  updateWorkspaceMemberRoleAction,
} from "./actions";

type Role = "OWNER" | "ADMIN" | "MEMBER";
type Member = {
  id: string;
  role: Role;
  createdAt: string;
  userId: string;
  user: { email: string; image: string | null; name: string | null };
};

const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function displayName(member: Member) {
  return member.user.name?.trim() || member.user.email;
}

export function TeamClient({
  actorRole,
  actorUserId,
  initialMembers,
  organizationId,
}: {
  actorRole: Role;
  actorUserId: string;
  initialMembers: Member[];
  organizationId: string;
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("MEMBER");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManage = actorRole !== "MEMBER";

  const addMutation = useMutation({
    mutationFn: async () => {
      const result = await addWorkspaceMemberAction(organizationId, {
        email,
        role: newRole,
      });
      if (!result.success) throw new Error(result.error);
      return result.member;
    },
    onMutate: () => {
      setError(null);
      setMessage(null);
    },
    onError: (mutationError) => setError(mutationError.message),
    onSuccess: (member) => {
      setMembers((current) => [...current, member]);
      setEmail("");
      setNewRole("MEMBER");
      setMessage("Workspace member added.");
      router.refresh();
    },
  });

  const roleMutation = useMutation<
    { id: string; role: Role; userId: string },
    Error,
    { memberId: string; role: Role },
    { previous: Member[] }
  >({
    mutationFn: async (input) => {
      const result = await updateWorkspaceMemberRoleAction(
        organizationId,
        input,
      );
      if (!result.success) throw new Error(result.error);
      return result.member;
    },
    onMutate: (input) => {
      setError(null);
      setMessage(null);
      const previous = members;
      setMembers((current) =>
        current.map((member) =>
          member.id === input.memberId
            ? { ...member, role: input.role }
            : member,
        ),
      );
      return { previous };
    },
    onError: (mutationError, _input, context) => {
      if (context) setMembers(context.previous);
      setError(mutationError.message);
    },
    onSuccess: () => {
      setMessage("Member role updated.");
      router.refresh();
    },
  });

  const removeMutation = useMutation<
    { id: string },
    Error,
    string,
    { previous: Member[] }
  >({
    mutationFn: async (memberId) => {
      const result = await removeWorkspaceMemberAction(organizationId, {
        memberId,
      });
      if (!result.success) throw new Error(result.error);
      return result.member;
    },
    onMutate: (memberId) => {
      setError(null);
      setMessage(null);
      const previous = members;
      setMembers((current) =>
        current.filter((member) => member.id !== memberId),
      );
      return { previous };
    },
    onError: (mutationError, _memberId, context) => {
      if (context) setMembers(context.previous);
      setError(mutationError.message);
    },
    onSuccess: () => {
      setMessage("Workspace member removed.");
      router.refresh();
    },
  });

  return (
    <div className="grid gap-6">
      {canManage ? (
        <Card className="p-5 sm:p-6">
          <form
            className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              if (email.trim()) addMutation.mutate();
            }}
          >
            <label className="grid gap-1.5 text-xs font-medium text-muted">
              Aurbit account email
              <Input
                autoComplete="email"
                disabled={addMutation.isPending}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="teammate@example.com"
                type="email"
                value={email}
              />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-muted">
              Role
              <Select
                disabled={addMutation.isPending || actorRole === "ADMIN"}
                onChange={(event) => setNewRole(event.target.value as Role)}
                value={newRole}
              >
                {actorRole === "OWNER" ? (
                  <option value="OWNER">Owner</option>
                ) : null}
                {actorRole === "OWNER" ? (
                  <option value="ADMIN">Admin</option>
                ) : null}
                <option value="MEMBER">Member</option>
              </Select>
            </label>
            <Button
              disabled={addMutation.isPending || !email.trim()}
              type="submit"
            >
              {addMutation.isPending ? "Adding…" : "Add member"}
            </Button>
          </form>
          <p className="mt-3 text-xs leading-5 text-muted">
            The person must already have a verified Aurbit account.
          </p>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="border-b border-border bg-surface px-5 py-4 sm:px-6">
          <h2 className="text-sm font-semibold text-primary">
            Workspace members
          </h2>
          <p className="mt-1 text-xs text-muted">
            {members.length} {members.length === 1 ? "member" : "members"}
          </p>
        </div>
        <ul className="divide-y divide-border">
          {members.map((member) => {
            const isSelf = member.userId === actorUserId;
            const actorCanManageTarget =
              !isSelf &&
              (actorRole === "OWNER" ||
                (actorRole === "ADMIN" && member.role === "MEMBER"));
            const name = displayName(member);

            return (
              <li
                className="grid gap-4 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_8rem_8rem] sm:items-center sm:px-6"
                key={member.id}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={name} size="sm" src={member.user.image} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-primary">
                      {name}{" "}
                      {isSelf ? (
                        <span className="text-muted">(you)</span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {member.user.email}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Joined {formatDate(member.createdAt)}
                    </p>
                  </div>
                </div>

                {actorCanManageTarget ? (
                  <Select
                    aria-label={`Role for ${name}`}
                    disabled={
                      roleMutation.isPending || removeMutation.isPending
                    }
                    onChange={(event) =>
                      roleMutation.mutate({
                        memberId: member.id,
                        role: event.target.value as Role,
                      })
                    }
                    value={member.role}
                  >
                    {actorRole === "OWNER" ? (
                      <option value="OWNER">Owner</option>
                    ) : null}
                    <option value="ADMIN">Admin</option>
                    <option value="MEMBER">Member</option>
                  </Select>
                ) : (
                  <span className="text-sm text-secondary">
                    {ROLE_LABELS[member.role]}
                  </span>
                )}

                {actorCanManageTarget ? (
                  <Button
                    disabled={
                      roleMutation.isPending || removeMutation.isPending
                    }
                    onClick={() => {
                      if (
                        window.confirm(
                          `Remove ${name} from this workspace? They will immediately lose access.`,
                        )
                      ) {
                        removeMutation.mutate(member.id);
                      }
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Remove
                  </Button>
                ) : (
                  <span />
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <p
        aria-live="polite"
        className={error ? "text-sm text-danger" : "text-sm text-muted"}
      >
        {error || message}
      </p>
    </div>
  );
}
