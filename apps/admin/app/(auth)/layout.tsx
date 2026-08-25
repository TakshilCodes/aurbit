import aurbitWordmark from "@aurbit/ui/brand/iconwithtext-transparent";
import { Card } from "@aurbit/ui/card";
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-svh place-items-center bg-background px-5 py-10 sm:px-6">
      <Card className="w-full max-w-md border-border-strong p-[clamp(1.5rem,5vw,2.5rem)]">
        <div className="mb-8 flex items-center gap-2.5">
          <Image
            alt="Aurbit"
            className="h-7 w-auto object-contain"
            priority
            src={aurbitWordmark}
          />
          <span aria-hidden="true" className="h-4 w-px bg-border-strong" />
          <p className="text-[0.6875rem] font-semibold tracking-[0.12em] text-muted uppercase">
            Admin
          </p>
        </div>
        {children}
      </Card>
    </main>
  );
}
