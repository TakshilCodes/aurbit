import { db } from "@aurbit/db";
import { Badge } from "@aurbit/ui/badge";
import aurbitIcon from "@aurbit/ui/brand/icon-transparent";
import aurbitWordmark from "@aurbit/ui/brand/iconwithtext-transparent";
import { Button, buttonStyles } from "@aurbit/ui/button";
import Image from "next/image";
import Link from "next/link";
import { requirePageUser } from "../../lib/page-access";
import { logoutAction, switchOrganizationAction } from "./actions";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requirePageUser();
  const memberships = await db.organizationMember.findMany({
    where: { userId: user.id },
    include: { organization: true },
    orderBy: { organization: { name: "asc" } },
  });

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-4 border-b border-border bg-background/90 px-5 backdrop-blur-md sm:px-6">
        <Link
          className="flex items-center gap-2.5 text-primary no-underline"
          href="/"
        >
          <Image
            alt="Aurbit"
            className="size-8 object-contain sm:hidden"
            priority
            src={aurbitIcon}
          />
          <Image
            alt="Aurbit"
            className="hidden h-7 w-auto object-contain sm:block"
            priority
            src={aurbitWordmark}
          />
        </Link>
        <nav aria-label="Account" className="flex items-center gap-1">
          <span className="mr-2 hidden max-w-52 truncate text-xs text-muted md:inline">
            {user.email}
          </span>
          <Link
            className={buttonStyles({ size: "sm", variant: "ghost" })}
            href="/organizations"
          >
            Organizations
          </Link>
          <form action={logoutAction}>
            <Button size="sm" type="submit" variant="ghost">
              Log out
            </Button>
          </form>
        </nav>
      </header>
      <div className="grid min-h-[calc(100svh-4rem)] grid-cols-[16rem_minmax(0,1fr)] max-[44rem]:grid-cols-1">
        <aside className="sticky top-16 h-[calc(100svh-4rem)] overflow-y-auto border-r border-border bg-surface/45 px-3 py-5 max-[44rem]:static max-[44rem]:h-auto max-[44rem]:overflow-visible max-[44rem]:border-r-0 max-[44rem]:border-b max-[44rem]:px-5 max-[44rem]:py-4">
          <div className="mb-3 flex items-center justify-between px-2 max-[44rem]:px-0">
            <p className="text-[0.6875rem] font-semibold tracking-[0.1em] text-muted uppercase">
              Workspaces
            </p>
            <Link
              className="text-xs font-medium text-secondary underline-offset-4 hover:text-primary hover:underline"
              href="/organizations/new"
            >
              New
            </Link>
          </div>
          {memberships.length ? (
            <div className="grid gap-1 max-[44rem]:grid-flow-col max-[44rem]:auto-cols-[minmax(11rem,1fr)] max-[44rem]:overflow-x-auto max-[44rem]:pb-1">
              {memberships.map(({ organization, role }) => {
                const active = user.activeOrganizationId === organization.id;
                return (
                  <form action={switchOrganizationAction} key={organization.id}>
                    <input
                      name="organizationId"
                      type="hidden"
                      value={organization.id}
                    />
                    <button
                      aria-current={active ? "page" : undefined}
                      className="group flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-transparent bg-transparent px-3 py-2 text-left text-secondary transition-colors duration-150 hover:bg-interactive hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus aria-[current=page]:border-border aria-[current=page]:bg-surface-elevated aria-[current=page]:text-primary motion-reduce:transition-none"
                      type="submit"
                    >
                      <span className="min-w-0 truncate text-sm font-medium">
                        {organization.name}
                      </span>
                      <Badge
                        className={
                          active
                            ? "border-border-strong bg-interactive"
                            : "border-transparent bg-transparent"
                        }
                      >
                        {role.toLowerCase()}
                      </Badge>
                    </button>
                  </form>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-3 py-4 text-sm leading-5 text-muted">
              No organizations yet.
            </div>
          )}
        </aside>
        <main className="min-w-0 px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
          {children}
        </main>
      </div>
    </div>
  );
}
