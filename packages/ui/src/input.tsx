import type { ComponentProps } from "react";
import { cn } from "./cn";

export type InputProps = ComponentProps<"input">;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-lg border border-border bg-input px-3.5 py-2.5 text-sm text-primary outline-none transition-[background-color,border-color,box-shadow] duration-150 placeholder:text-muted hover:border-border-strong focus-visible:border-secondary focus-visible:bg-surface-elevated focus-visible:ring-3 focus-visible:ring-focus/15 aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger/10 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}
