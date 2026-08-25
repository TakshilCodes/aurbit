import type { ReactNode } from "react";
import { cn } from "./cn";

export function EmptyState({
  action,
  className,
  description,
  title,
}: {
  action?: ReactNode;
  className?: string;
  description: string;
  title: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-48 flex-col items-start justify-center rounded-xl border border-dashed border-border-strong bg-surface/70 p-8",
        className,
      )}
    >
      <h2 className="text-base font-semibold text-primary">{title}</h2>
      <p className="mt-2 max-w-lg text-sm leading-6 text-secondary">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
