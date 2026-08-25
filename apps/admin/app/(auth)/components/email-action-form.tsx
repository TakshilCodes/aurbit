"use client";

import { Button } from "@aurbit/ui/button";
import { FormField } from "@aurbit/ui/form-field";
import { Input } from "@aurbit/ui/input";
import { useActionState, useState } from "react";
import type { AuthActionState } from "../actions";
import { ActionMessage } from "./action-message";

const initialState: AuthActionState = {};

type EmailAction = (
  state: AuthActionState,
  formData: FormData,
) => Promise<AuthActionState>;

export function EmailActionForm({
  action,
  buttonLabel,
  pendingLabel,
}: {
  action: EmailAction;
  buttonLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [email, setEmail] = useState("");

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormField
        error={state.fieldErrors?.email}
        id="email-action-address"
        label="Email"
      >
        <Input
          aria-describedby={
            state.fieldErrors?.email ? "email-action-address-error" : undefined
          }
          aria-invalid={Boolean(state.fieldErrors?.email)}
          autoComplete="email"
          id="email-action-address"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          value={email}
          type="email"
        />
      </FormField>
      <ActionMessage state={state} />
      <Button className="mt-1 w-full" disabled={pending} type="submit">
        {pending ? pendingLabel : buttonLabel}
      </Button>
    </form>
  );
}
