import { buttonStyles } from "@aurbit/ui/button";
import { Card } from "@aurbit/ui/card";
import Link from "next/link";

export default function ReportNotFound() {
  return (
    <main className="grid min-h-svh place-items-center bg-background px-5 py-10 sm:px-6">
      <Card className="w-full max-w-md border-border-strong p-[clamp(1.5rem,5vw,2.5rem)]">
        <p className="mb-3 text-xs font-semibold tracking-[0.08em] text-secondary uppercase">
          Aurbit report
        </p>
        <h1 className="text-2xl leading-tight tracking-[-0.03em] text-primary">
          Report page unavailable
        </h1>
        <p className="mt-4 leading-7 text-secondary">
          This project key is invalid or no longer available. Check the report
          link and try again.
        </p>
        <Link
          className={buttonStyles({ className: "mt-7", variant: "secondary" })}
          href="/"
        >
          Back to Aurbit
        </Link>
      </Card>
    </main>
  );
}
