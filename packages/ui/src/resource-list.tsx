import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

export function ResourceList({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-surface divide-y divide-border",
        className,
      )}
      {...props}
    />
  );
}

export function resourceRowStyles(className?: string) {
  return cn(
    "flex min-h-18 items-center justify-between gap-4 px-5 py-4 text-inherit no-underline transition-colors duration-150 hover:bg-interactive focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none max-sm:items-start",
    className,
  );
}

export function ResourceIdentity({
  meta,
  title,
}: {
  meta: ReactNode;
  title: ReactNode;
}) {
  return (
    <span className="grid min-w-0 gap-1">
      <strong className="truncate text-sm font-medium text-primary">
        {title}
      </strong>
      <small className="truncate font-mono text-xs text-muted">{meta}</small>
    </span>
  );
}
