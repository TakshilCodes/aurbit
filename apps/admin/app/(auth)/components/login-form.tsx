"use client";

import { Button } from "@aurbit/ui/button";
import { FormField } from "@aurbit/ui/form-field";
import { Input } from "@aurbit/ui/input";
import { PasswordInput } from "@aurbit/ui/password-input";
import { useActionState, useState } from "react";
import {
  googleLoginAction,
  loginAction,
  magicLinkAction,
  type AuthActionState,
} from "../actions";
import { ActionMessage } from "./action-message";
import { AuthDivider, GoogleIcon } from "./auth-patterns";
import { TurnstileWidget } from "@aurbit/turnstile/widget";

const initialState: AuthActionState = {};
const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export function LoginForm({
  redirectTo,
  googleEnabled,
  emailEnabled,
}: {
  redirectTo: string;
  googleEnabled: boolean;
  emailEnabled: boolean;
}) {
  const [loginState, loginFormAction, loginPending] = useActionState(
    loginAction,
    initialState,
  );
  const [magicState, magicFormAction, magicPending] = useActionState(
    magicLinkAction,
    initialState,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magicEmail, setMagicEmail] = useState("");
  const [loginToken, setLoginToken] = useState("");
  const [magicToken, setMagicToken] = useState("");

  return (
    <div className="grid gap-6">
      {googleEnabled ? (
        <>
          <form action={googleLoginAction}>
            <input name="redirectTo" type="hidden" value={redirectTo} />
            <Button className="w-full" type="submit" variant="secondary">
              <GoogleIcon />
              Continue with Google
            </Button>
          </form>
          <AuthDivider>or continue with email</AuthDivider>
        </>
      ) : null}

      <form action={loginFormAction} className="grid gap-4" noValidate>
        <input name="redirectTo" type="hidden" value={redirectTo} />
        <FormField
          error={loginState.fieldErrors?.email}
          id="login-email"
          label="Email"
        >
          <Input
            aria-describedby={
              loginState.fieldErrors?.email ? "login-email-error" : undefined
            }
            aria-invalid={Boolean(loginState.fieldErrors?.email)}
            autoComplete="email"
            id="login-email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            value={email}
            type="email"
          />
        </FormField>
        <FormField
          error={loginState.fieldErrors?.password}
          id="login-password"
          label="Password"
        >
          <PasswordInput
            aria-describedby={
              loginState.fieldErrors?.password
                ? "login-password-error"
                : undefined
            }
            aria-invalid={Boolean(loginState.fieldErrors?.password)}
            autoComplete="current-password"
            id="login-password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            value={password}
          />
        </FormField>
        <input name="cf-turnstile-response" type="hidden" value={loginToken} />
        <TurnstileWidget
          action="login"
          onTokenChange={setLoginToken}
          pending={loginPending}
          siteKey={turnstileSiteKey}
        />
        <ActionMessage state={loginState} />
        <Button
          className="mt-1 w-full"
          disabled={loginPending || !loginToken}
          type="submit"
        >
          {loginPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {emailEnabled ? (
        <>
          <AuthDivider>magic link</AuthDivider>
          <form action={magicFormAction} className="grid gap-4" noValidate>
            <input name="redirectTo" type="hidden" value={redirectTo} />
            <FormField
              error={magicState.fieldErrors?.email}
              id="magic-email"
              label="Email"
            >
              <Input
                aria-describedby={
                  magicState.fieldErrors?.email
                    ? "magic-email-error"
                    : undefined
                }
                aria-invalid={Boolean(magicState.fieldErrors?.email)}
                autoComplete="email"
                id="magic-email"
                name="email"
                onChange={(event) => setMagicEmail(event.target.value)}
                required
                value={magicEmail}
                type="email"
              />
            </FormField>
            <input
              name="cf-turnstile-response"
              type="hidden"
              value={magicToken}
            />
            <TurnstileWidget
              action="magic-link"
              onTokenChange={setMagicToken}
              pending={magicPending}
              siteKey={turnstileSiteKey}
            />
            <ActionMessage state={magicState} />
            <Button
              className="w-full"
              disabled={magicPending || !magicToken}
              type="submit"
              variant="secondary"
            >
              {magicPending ? "Sending link…" : "Email me a sign-in link"}
            </Button>
          </form>
        </>
      ) : null}
    </div>
  );
}
