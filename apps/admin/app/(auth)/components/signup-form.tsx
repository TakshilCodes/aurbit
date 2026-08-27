"use client";

import { Button } from "@aurbit/ui/button";
import { FormField } from "@aurbit/ui/form-field";
import { Input } from "@aurbit/ui/input";
import { PasswordInput } from "@aurbit/ui/password-input";
import { useActionState, useState } from "react";
import {
  googleLoginAction,
  signupAction,
  type AuthActionState,
} from "../actions";
import { ActionMessage } from "./action-message";
import { AuthDivider, GoogleIcon } from "./auth-patterns";
import { TurnstileWidget } from "./turnstile-widget";

const initialState: AuthActionState = {};
const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export function SignupForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [state, formAction, pending] = useActionState(
    signupAction,
    initialState,
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");

  return (
    <div className="grid gap-6">
      {googleEnabled ? (
        <>
          <form action={googleLoginAction}>
            <Button className="w-full" type="submit" variant="secondary">
              <GoogleIcon />
              Sign up with Google
            </Button>
          </form>
          <AuthDivider>or create a password account</AuthDivider>
        </>
      ) : null}

      <form action={formAction} className="grid gap-4" noValidate>
        <FormField
          error={state.fieldErrors?.name}
          id="signup-name"
          label="Name"
        >
          <Input
            aria-describedby={
              state.fieldErrors?.name ? "signup-name-error" : undefined
            }
            aria-invalid={Boolean(state.fieldErrors?.name)}
            autoComplete="name"
            id="signup-name"
            maxLength={100}
            name="name"
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </FormField>
        <FormField
          error={state.fieldErrors?.email}
          id="signup-email"
          label="Email"
        >
          <Input
            aria-describedby={
              state.fieldErrors?.email ? "signup-email-error" : undefined
            }
            aria-invalid={Boolean(state.fieldErrors?.email)}
            autoComplete="email"
            id="signup-email"
            maxLength={254}
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            value={email}
            type="email"
          />
        </FormField>
        <FormField
          error={state.fieldErrors?.password}
          hint="Use at least 8 characters and avoid common passwords."
          id="signup-password"
          label="Password"
        >
          <PasswordInput
            aria-describedby={
              state.fieldErrors?.password
                ? "signup-password-error"
                : "signup-password-hint"
            }
            aria-invalid={Boolean(state.fieldErrors?.password)}
            autoComplete="new-password"
            id="signup-password"
            minLength={8}
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            value={password}
          />
        </FormField>
        <FormField
          error={state.fieldErrors?.confirmPassword}
          id="signup-confirm-password"
          label="Confirm password"
        >
          <PasswordInput
            aria-describedby={
              state.fieldErrors?.confirmPassword
                ? "signup-confirm-password-error"
                : undefined
            }
            aria-invalid={Boolean(state.fieldErrors?.confirmPassword)}
            autoComplete="new-password"
            id="signup-confirm-password"
            minLength={8}
            name="confirmPassword"
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            value={confirmPassword}
          />
        </FormField>
        <input
          name="cf-turnstile-response"
          type="hidden"
          value={turnstileToken}
        />
        <TurnstileWidget
          action="signup"
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
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </div>
  );
}
