import type { ComponentProps } from "react";
import { cn } from "./cn";

export type SelectProps = ComponentProps<"select">;

export function Select({ className, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "min-h-11 w-full rounded-lg border border-border bg-input px-3.5 py-2.5 text-sm text-primary outline-none transition-[background-color,border-color,box-shadow] duration-150 hover:border-border-strong focus-visible:border-secondary focus-visible:bg-surface-elevated focus-visible:ring-3 focus-visible:ring-focus/15 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}
