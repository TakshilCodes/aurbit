"use client";

import { useState } from "react";
import { cn } from "./cn";
import { Input, type InputProps } from "./input";

export type PasswordInputProps = Omit<InputProps, "type">;

function VisibilityIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg
      aria-hidden="true"
      className="size-[1.125rem]"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m3 3 18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 5 9 5a17.5 17.5 0 0 1-3.1 3.5M6.6 6.6C4.4 8 3 10 3 10s3.5 5 9 5c1 0 2-.2 2.9-.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  ) : (
    <svg
      aria-hidden="true"
      className="size-[1.125rem]"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
      <circle
        cx="12"
        cy="12"
        r="2.25"
        stroke="currentColor"
        strokeWidth="1.75"
      />
    </svg>
  );
}

export function PasswordInput({
  className,
  disabled,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        className={cn("pr-12", className)}
        disabled={disabled}
        type={visible ? "text" : "password"}
        {...props}
      />
      <button
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-md border border-transparent bg-transparent text-muted transition-colors duration-150 hover:bg-interactive hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none"
        disabled={disabled}
        onClick={() => setVisible((current) => !current)}
        type="button"
      >
        <VisibilityIcon visible={visible} />
      </button>
    </div>
  );
}
