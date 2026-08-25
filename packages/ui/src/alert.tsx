import type { ComponentProps } from "react";
import { cn } from "./cn";

export function Alert({
  children,
  className,
  variant = "error",
  ...props
}: ComponentProps<"div"> & { variant?: "error" | "success" }) {
  const success = variant === "success";

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-5",
        success
          ? "border-success/25 bg-success-surface text-success"
          : "border-danger/25 bg-danger-surface text-danger",
        className,
      )}
      {...props}
    >
      <svg
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0"
        fill="none"
        viewBox="0 0 20 20"
      >
        {success ? (
          <path
            d="m5.5 10 3 3 6-6"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        ) : (
          <>
            <circle cx="10" cy="10" r="7.5" stroke="currentColor" />
            <path
              d="M10 6.5v4M10 13.5h.01"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.5"
            />
          </>
        )}
      </svg>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
