"use client";

import { Alert } from "@aurbit/ui/alert";
import { Avatar } from "@aurbit/ui/avatar";
import { Button } from "@aurbit/ui/button";
import { Card } from "@aurbit/ui/card";
import { Input } from "@aurbit/ui/input";
import { Select } from "@aurbit/ui/select";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createWorkspaceInviteAction,
  removeWorkspaceMemberAction,
  resendWorkspaceInviteAction,
  revokeWorkspaceInviteAction,
  updateWorkspaceMemberRoleAction,
} from "./actions";

type Role = "OWNER" | "ADMIN" | "MEMBER";
type InvitableRole = "ADMIN" | "MEMBER";
type Member = {
  id: string;
  role: Role;
  createdAt: string;
  userId: string;
  user: { email: string; image: string | null; name: string | null };
};
type Invite = {
  id: string;
  email: string;
  role: InvitableRole;
  createdAt: string;
  expiresAt: string;
  lastSentAt: string;
  invitedBy: { email: string; name: string | null };
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
  initialInvites,
  initialMembers,
  organizationId,
}: {
  actorRole: Role;
  actorUserId: string;
  initialInvites: Invite[];
  initialMembers: Member[];
  organizationId: string;
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [invites, setInvites] = useState(initialInvites);
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<InvitableRole>("MEMBER");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManage = actorRole !== "MEMBER";

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const result = await createWorkspaceInviteAction(organizationId, {
        email,
        role: newRole,
      });
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onMutate: () => {
      setError(null);
      setMessage(null);
    },
    onError: (mutationError) => setError(mutationError.message),
    onSuccess: (result) => {
      setInvites((current) => [result.invite, ...current]);
      setEmail("");
      setNewRole("MEMBER");
      setMessage(
        result.delivery === "sent"
          ? "Invitation sent."
          : "Invitation created, but email delivery failed. Use Resend to try again.",
      );
      router.refresh();
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const result = await resendWorkspaceInviteAction(organizationId, {
        inviteId,
      });
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onMutate: () => {
      setError(null);
      setMessage(null);
    },
    onError: (mutationError) => setError(mutationError.message),
    onSuccess: (result) => {
      setInvites((current) =>
        current.map((invite) =>
          invite.id === result.invite.id ? result.invite : invite,
        ),
      );
      setMessage(
        result.delivery === "sent"
          ? "Invitation resent with a new secure link."
          : "The old link was invalidated, but email delivery failed. Try resending again later.",
      );
      router.refresh();
    },
  });

  const revokeMutation = useMutation<
    { id: string },
    Error,
    string,
    { previous: Invite[] }
  >({
    mutationFn: async (inviteId) => {
      const result = await revokeWorkspaceInviteAction(organizationId, {
        inviteId,
      });
      if (!result.success) throw new Error(result.error);
      return result.invite;
    },
    onMutate: (inviteId) => {
      setError(null);
      setMessage(null);
      const previous = invites;
      setInvites((current) =>
        current.filter((invite) => invite.id !== inviteId),
      );
      return { previous };
    },
    onError: (mutationError, _inviteId, context) => {
      if (context) setInvites(context.previous);
      setError(mutationError.message);
    },
    onSuccess: () => {
      setMessage("Invitation revoked.");
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

  const inviteBusy =
    inviteMutation.isPending ||
    resendMutation.isPending ||
    revokeMutation.isPending;

  return (
    <div className="grid gap-6">
      {canManage ? (
        <Card className="p-5 sm:p-6">
          <form
            className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              if (email.trim()) inviteMutation.mutate();
            }}
          >
            <label className="grid gap-1.5 text-xs font-medium text-muted">
              Email
              <Input
                autoComplete="email"
                disabled={inviteBusy}
                maxLength={254}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="teammate@example.com"
                required
                type="email"
                value={email}
              />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-muted">
              Role
              <Select
                disabled={inviteBusy || actorRole === "ADMIN"}
                onChange={(event) =>
                  setNewRole(event.target.value as InvitableRole)
                }
                value={newRole}
              >
                {actorRole === "OWNER" ? (
                  <option value="ADMIN">Admin</option>
                ) : null}
                <option value="MEMBER">Member</option>
              </Select>
            </label>
            <Button disabled={inviteBusy || !email.trim()} type="submit">
              {inviteMutation.isPending ? "Sending…" : "Send invitation"}
            </Button>
          </form>
          <p className="mt-3 text-xs leading-5 text-muted">
            Membership begins only after the recipient signs in with this
            verified email and accepts the invitation.
          </p>
        </Card>
      ) : null}

      {error ? (
        <Alert role="alert">{error}</Alert>
      ) : message ? (
        <Alert role="status" variant="success">
          {message}
        </Alert>
      ) : null}

      <Card className="overflow-hidden">
        <div className="border-b border-border bg-surface px-5 py-4 sm:px-6">
          <h2 className="text-sm font-semibold text-primary">
            Pending invites
          </h2>
          <p className="mt-1 text-xs text-muted">
            {invites.length} pending{" "}
            {invites.length === 1 ? "invite" : "invites"}
          </p>
        </div>
        {invites.length ? (
          <ul className="divide-y divide-border">
            {invites.map((invite) => {
              const expired = new Date(invite.expiresAt) <= new Date();
              const actorCanManage =
                actorRole === "OWNER" ||
                (actorRole === "ADMIN" && invite.role === "MEMBER");
              const invitedBy =
                invite.invitedBy.name?.trim() || invite.invitedBy.email;
              return (
                <li
                  className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-center sm:px-6"
                  key={invite.id}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-primary">
                      {invite.email}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Invited by {invitedBy} on {formatDate(invite.createdAt)}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {expired
                        ? `Expired ${formatDate(invite.expiresAt)}`
                        : `Expires ${formatDate(invite.expiresAt)}`}
                    </p>
                  </div>
                  <span
                    className={
                      expired ? "text-sm text-danger" : "text-sm text-secondary"
                    }
                  >
                    {ROLE_LABELS[invite.role]} ·{" "}
                    {expired ? "Expired" : "Pending"}
                  </span>
                  {actorCanManage ? (
                    <div className="flex gap-1">
                      <Button
                        disabled={inviteBusy}
                        onClick={() => resendMutation.mutate(invite.id)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Resend
                      </Button>
                      <Button
                        disabled={inviteBusy}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Revoke the invitation for ${invite.email}?`,
                            )
                          ) {
                            revokeMutation.mutate(invite.id);
                          }
                        }}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Revoke
                      </Button>
                    </div>
                  ) : (
                    <span />
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-5 py-6 text-sm text-muted sm:px-6">
            No pending workspace invitations.
          </p>
        )}
      </Card>

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
    </div>
  );
}
