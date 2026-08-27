"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      remove(widgetId: string): void;
      render(
        container: HTMLElement,
        options: {
          action: string;
          appearance: "interaction-only";
          callback: (token: string) => void;
          "error-callback": () => void;
          "expired-callback": () => void;
          sitekey: string;
          size: "flexible";
          theme: "dark";
        },
      ): string;
      reset(widgetId: string): void;
    };
  }
}

export function TurnstileWidget({
  action,
  pending,
  siteKey,
  onTokenChange,
}: {
  action: string;
  pending: boolean;
  siteKey: string;
  onTokenChange: (token: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const wasPendingRef = useRef(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (
      !scriptReady ||
      !siteKey ||
      !containerRef.current ||
      !window.turnstile ||
      widgetIdRef.current
    ) {
      return;
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      appearance: "interaction-only",
      size: "flexible",
      theme: "dark",
      callback(token) {
        setError(false);
        onTokenChange(token);
      },
      "error-callback"() {
        setError(true);
        onTokenChange("");
      },
      "expired-callback"() {
        onTokenChange("");
      },
    });

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [action, onTokenChange, scriptReady, siteKey]);

  useEffect(() => {
    if (
      wasPendingRef.current &&
      !pending &&
      widgetIdRef.current &&
      window.turnstile
    ) {
      onTokenChange("");
      window.turnstile.reset(widgetIdRef.current);
    }

    wasPendingRef.current = pending;
  }, [onTokenChange, pending]);

  return (
    <>
      <Script
        id="cloudflare-turnstile"
        onReady={() => setScriptReady(true)}
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
      />
      <div ref={containerRef} />
      {error || !siteKey ? (
        <p className="text-sm text-danger" role="alert">
          Security verification is unavailable. Refresh and try again.
        </p>
      ) : null}
    </>
  );
}
