import type { ComponentProps } from "react";
import { cn } from "./cn";

export function Badge({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border-strong bg-interactive px-2 py-0.5 text-[0.6875rem] font-medium tracking-wide text-secondary capitalize",
        className,
      )}
      {...props}
    />
  );
}
