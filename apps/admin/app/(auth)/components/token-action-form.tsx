"use client";

import { Button } from "@aurbit/ui/button";
import { FormField } from "@aurbit/ui/form-field";
import { PasswordInput } from "@aurbit/ui/password-input";
import { useActionState, useState } from "react";
import {
  resetPasswordAction,
  verifyEmailAction,
  type AuthActionState,
} from "../actions";
import { ActionMessage } from "./action-message";

const initialState: AuthActionState = {};

export function VerifyEmailForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    verifyEmailAction,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <input name="token" type="hidden" value={token} />
      <ActionMessage state={state} />
      <Button className="w-full" disabled={pending} type="submit">
        {pending ? "Verifying…" : "Verify email"}
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    resetPasswordAction,
    initialState,
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <input name="token" type="hidden" value={token} />
      <FormField
        error={state.fieldErrors?.password}
        hint="Use at least 8 characters and avoid common passwords."
        id="reset-password"
        label="New password"
      >
        <PasswordInput
          aria-describedby={
            state.fieldErrors?.password
              ? "reset-password-error"
              : "reset-password-hint"
          }
          aria-invalid={Boolean(state.fieldErrors?.password)}
          autoComplete="new-password"
          id="reset-password"
          minLength={8}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          value={password}
        />
      </FormField>
      <FormField
        error={state.fieldErrors?.confirmPassword}
        id="reset-confirm-password"
        label="Confirm password"
      >
        <PasswordInput
          aria-describedby={
            state.fieldErrors?.confirmPassword
              ? "reset-confirm-password-error"
              : undefined
          }
          aria-invalid={Boolean(state.fieldErrors?.confirmPassword)}
          autoComplete="new-password"
          id="reset-confirm-password"
          minLength={8}
          name="confirmPassword"
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          value={confirmPassword}
        />
      </FormField>
      <ActionMessage state={state} />
      <Button className="mt-1 w-full" disabled={pending} type="submit">
        {pending ? "Resetting password…" : "Reset password"}
      </Button>
    </form>
  );
}
