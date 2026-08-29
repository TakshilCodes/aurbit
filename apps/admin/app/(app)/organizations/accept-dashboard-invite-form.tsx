"use client";

import { Alert } from "@aurbit/ui/alert";
import { Button } from "@aurbit/ui/button";
import { useActionState } from "react";
import {
  acceptDashboardInviteAction,
  type DashboardInviteState,
} from "./actions";

const initialState: DashboardInviteState = {};

export function AcceptDashboardInviteForm({ inviteId }: { inviteId: string }) {
  const [state, formAction, pending] = useActionState(
    acceptDashboardInviteAction.bind(null, inviteId),
    initialState,
  );

  return (
    <form action={formAction} className="grid justify-items-end gap-2">
      <Button disabled={pending} size="sm" type="submit">
        {pending ? "Joining…" : "Accept invitation"}
      </Button>
      {state.error ? (
        <Alert className="max-w-sm" role="alert">
          {state.error}
        </Alert>
      ) : null}
    </form>
  );
}
