"use client";

import { Button } from "@aurbit/ui/button";
import { FormField } from "@aurbit/ui/form-field";
import { Input } from "@aurbit/ui/input";
import { useActionState, useState } from "react";
import type { AuthProtectionFlow } from "../../../lib/auth-protection";
import type { AuthActionState } from "../actions";
import { ActionMessage } from "./action-message";
import { TurnstileWidget } from "@aurbit/turnstile/widget";

const initialState: AuthActionState = {};
const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

type EmailAction = (
  state: AuthActionState,
  formData: FormData,
) => Promise<AuthActionState>;

export function EmailActionForm({
  action,
  buttonLabel,
  pendingLabel,
  turnstileAction,
  redirectTo = "/",
}: {
  action: EmailAction;
  buttonLabel: string;
  pendingLabel: string;
  turnstileAction: AuthProtectionFlow;
  redirectTo?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <input name="redirectTo" type="hidden" value={redirectTo} />
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
      <input
        name="cf-turnstile-response"
        type="hidden"
        value={turnstileToken}
      />
      <TurnstileWidget
        action={turnstileAction}
        onTokenChange={setTurnstileToken}
        pending={pending}
        siteKey={turnstileSiteKey}
      />
      <ActionMessage state={state} />
      <Button
        className="mt-1 w-full"
        disabled={pending || !turnstileToken}
        type="submit"
      >
        {pending ? pendingLabel : buttonLabel}
      </Button>
    </form>
  );
}
