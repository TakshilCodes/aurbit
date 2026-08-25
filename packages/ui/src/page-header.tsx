import type { ReactNode } from "react";
import { cn } from "./cn";

export function PageHeader({
  action,
  className,
  description,
  eyebrow,
  id = "page-title",
  size = "default",
  title,
}: {
  action?: ReactNode;
  className?: string;
  description: string;
  eyebrow?: string;
  id?: string;
  size?: "compact" | "default";
  title: ReactNode;
}) {
  return (
    <header
      className={cn(
        "flex items-start justify-between gap-6 max-[44rem]:flex-col max-[44rem]:items-stretch",
        size === "default" ? "mb-10" : "mb-7",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-xs font-semibold tracking-[0.1em] text-muted uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className={cn(
            "text-balance font-semibold text-primary",
            size === "default"
              ? "text-[clamp(1.875rem,4vw,2.5rem)] leading-[1.08] tracking-[-0.045em]"
              : "text-[1.75rem] leading-tight tracking-[-0.035em]",
          )}
          id={id}
        >
          {title}
        </h1>
        <p
          className={cn(
            "mt-3 max-w-2xl text-pretty text-secondary",
            size === "default"
              ? "text-[0.9375rem] leading-6"
              : "text-sm leading-6",
          )}
        >
          {description}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
