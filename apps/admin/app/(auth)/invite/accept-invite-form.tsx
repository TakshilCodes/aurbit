"use client";

import { Alert } from "@aurbit/ui/alert";
import { Button } from "@aurbit/ui/button";
import { useActionState } from "react";
import { acceptWorkspaceInviteAction, type AcceptInviteState } from "./actions";

const initialState: AcceptInviteState = {};

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    acceptWorkspaceInviteAction.bind(null, token),
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-4">
      {state.error ? <Alert role="alert">{state.error}</Alert> : null}
      <Button disabled={pending} type="submit">
        {pending ? "Accepting…" : "Accept invitation"}
      </Button>
    </form>
  );
}
