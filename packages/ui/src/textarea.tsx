import type { ComponentProps } from "react";
import { cn } from "./cn";

export type TextareaProps = ComponentProps<"textarea">;

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "min-h-32 w-full resize-y rounded-lg border border-border bg-input px-3.5 py-3 text-sm leading-6 text-primary outline-none transition-[background-color,border-color,box-shadow] duration-150 placeholder:text-muted hover:border-border-strong focus-visible:border-secondary focus-visible:bg-surface-elevated focus-visible:ring-3 focus-visible:ring-focus/15 aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger/10 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}
