import type { ReactNode } from "react";
import { cn } from "./cn";

export function FormField({
  children,
  className,
  error,
  hint,
  id,
  label,
}: {
  children: ReactNode;
  className?: string;
  error?: string | string[];
  hint?: string;
  id: string;
  label: string;
}) {
  const errors = typeof error === "string" ? [error] : error;

  return (
    <div className={cn("grid gap-2", className)}>
      <label className="text-sm font-medium text-primary" htmlFor={id}>
        {label}
      </label>
      {children}
      {errors?.length ? (
        <div
          className="flex items-start gap-2 rounded-md border border-danger/20 bg-danger-surface px-2.5 py-2 text-xs leading-5 text-danger"
          id={`${id}-error`}
          role="alert"
        >
          <svg
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
            fill="none"
            viewBox="0 0 20 20"
          >
            <circle cx="10" cy="10" r="7.5" stroke="currentColor" />
            <path
              d="M10 6.5v4M10 13.5h.01"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.5"
            />
          </svg>
          <ul className="grid gap-0.5">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : hint ? (
        <p className="text-xs leading-5 text-muted" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
