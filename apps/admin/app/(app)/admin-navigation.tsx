"use client";

import { Avatar } from "@aurbit/ui/avatar";
import { Badge } from "@aurbit/ui/badge";
import aurbitIcon from "@aurbit/ui/brand/icon-transparent";
import aurbitWordmark from "@aurbit/ui/brand/iconwithtext-transparent";
import { Button } from "@aurbit/ui/button";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction, switchOrganizationAction } from "./actions";

type WorkspaceMembership = {
  organizationId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  organization: { id: string; name: string };
};

type NavigationUser = {
  email: string;
  image: string | null;
  name: string | null;
};

function workspaceFromPath(
  pathname: string,
  memberships: WorkspaceMembership[],
) {
  const match = pathname.match(/^\/organizations\/([^/]+)(?:\/|$)/);
  return memberships.find(
    ({ organizationId }) => organizationId === match?.[1],
  );
}

function sectionFromPath(pathname: string) {
  if (pathname === "/organizations/new") return "Create workspace";
  if (pathname === "/organizations") return "Workspaces";
  if (pathname.includes("/reports")) return "Reports";
  if (pathname.includes("/projects")) return "Projects";
  if (pathname.includes("/team")) return "Team";
  if (pathname.includes("/audit")) return "Audit log";
  return "Dashboard";
}

export function AdminNavigation({
  activeOrganizationId,
  children,
  memberships,
  pendingInviteCount,
  user,
}: {
  activeOrganizationId?: string;
  children: React.ReactNode;
  memberships: WorkspaceMembership[];
  pendingInviteCount: number;
  user: NavigationUser;
}) {
  const pathname = usePathname();
  const activeWorkspace =
    workspaceFromPath(pathname, memberships) ??
    memberships.find(
      ({ organizationId }) => organizationId === activeOrganizationId,
    ) ??
    memberships[0];
  const workspaceId = activeWorkspace?.organizationId;
  const workspaceBase = workspaceId
    ? `/organizations/${workspaceId}`
    : undefined;
  const navigation = workspaceBase
    ? [
        {
          active: pathname.startsWith(`${workspaceBase}/reports`),
          href: `${workspaceBase}/reports`,
          label: "Reports",
        },
        {
          active: pathname.startsWith(`${workspaceBase}/projects`),
          href: `${workspaceBase}/projects`,
          label: "Projects",
        },
        {
          active: pathname.startsWith(`${workspaceBase}/team`),
          href: `${workspaceBase}/team`,
          label: "Team",
        },
        {
          active: pathname.startsWith(`${workspaceBase}/audit`),
          href: `${workspaceBase}/audit`,
          label: "Audit log",
        },
      ]
    : [];
  const userName = user.name?.trim() || user.email;

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 border-b border-border bg-background/90 px-5 backdrop-blur-md sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            aria-label="Aurbit dashboard"
            className="flex shrink-0 items-center text-primary no-underline"
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
          <span aria-hidden="true" className="text-muted">
            /
          </span>
          <p className="min-w-0 truncate text-sm text-secondary">
            {activeWorkspace ? `${activeWorkspace.organization.name} / ` : ""}
            <span className="text-primary">{sectionFromPath(pathname)}</span>
          </p>
        </div>
        <Avatar
          alt={`${userName} account`}
          name={userName}
          size="sm"
          src={user.image}
          title={userName}
        />
      </header>

      <div className="grid min-h-[calc(100svh-4rem)] grid-cols-[16rem_minmax(0,1fr)] max-[44rem]:grid-cols-1">
        <aside className="sticky top-16 flex h-[calc(100svh-4rem)] flex-col border-r border-border bg-surface/45 px-3 py-4 max-[44rem]:static max-[44rem]:h-auto max-[44rem]:border-r-0 max-[44rem]:border-b max-[44rem]:px-5">
          <details className="group relative">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-left transition-colors hover:border-border-strong hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="block text-[0.6875rem] font-semibold tracking-[0.08em] text-muted uppercase">
                  Workspace
                </span>
                <span className="mt-0.5 block truncate text-sm font-medium text-primary">
                  {activeWorkspace?.organization.name ?? "Choose a workspace"}
                </span>
              </span>
              <Image
                alt=""
                aria-hidden="true"
                className="size-4 opacity-70 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                height={16}
                src="/icons/down-arrow.png"
                width={16}
              />
            </summary>

            <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-40 grid max-h-80 gap-1 overflow-y-auto rounded-lg border border-border bg-surface-elevated p-1.5 shadow-lg">
              {memberships.map(({ organization, organizationId, role }) => {
                const active = organizationId === workspaceId;
                return (
                  <form action={switchOrganizationAction} key={organizationId}>
                    <input
                      name="organizationId"
                      type="hidden"
                      value={organizationId}
                    />
                    <button
                      aria-current={active ? "page" : undefined}
                      className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-sm text-secondary hover:bg-interactive hover:text-primary focus-visible:outline-2 focus-visible:outline-focus aria-[current=page]:bg-interactive aria-[current=page]:text-primary"
                      type="submit"
                    >
                      <span className="min-w-0 truncate font-medium">
                        {organization.name}
                      </span>
                      <Badge>{role.toLowerCase()}</Badge>
                    </button>
                  </form>
                );
              })}
              {memberships.length ? (
                <div className="my-1 border-t border-border" />
              ) : null}
              <Link
                className="flex min-h-10 items-center rounded-md px-2.5 text-sm font-medium text-secondary no-underline hover:bg-interactive hover:text-primary focus-visible:outline-2 focus-visible:outline-focus"
                href="/organizations/new"
              >
                Create workspace
              </Link>
              {memberships.length ? (
                <Link
                  className="flex min-h-10 items-center rounded-md px-2.5 text-sm text-muted no-underline hover:bg-interactive hover:text-primary focus-visible:outline-2 focus-visible:outline-focus"
                  href="/organizations"
                >
                  All workspaces
                </Link>
              ) : null}
            </div>
          </details>

          {pendingInviteCount ? (
            <Link
              className="mt-3 flex min-h-10 items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 text-sm text-secondary no-underline hover:bg-interactive hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              href="/organizations"
            >
              <span>
                Pending invitation{pendingInviteCount === 1 ? "" : "s"}
              </span>
              <Badge>{pendingInviteCount}</Badge>
            </Link>
          ) : null}

          <nav
            aria-label="Workspace navigation"
            className="mt-5 grid gap-1 max-[44rem]:grid-cols-2"
          >
            {navigation.map((item) => (
              <Link
                aria-current={item.active ? "page" : undefined}
                className="flex min-h-10 items-center rounded-lg border border-transparent px-3 text-sm font-medium text-secondary no-underline transition-colors hover:bg-interactive hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus aria-[current=page]:border-border aria-[current=page]:bg-surface-elevated aria-[current=page]:text-primary motion-reduce:transition-none"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto border-t border-border pt-4 max-[44rem]:mt-4">
            <div className="flex items-center gap-3 px-2">
              <Avatar name={userName} size="sm" src={user.image} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-primary">
                  {userName}
                </p>
                {user.name ? (
                  <p className="truncate text-xs text-muted">{user.email}</p>
                ) : null}
              </div>
            </div>
            <form action={logoutAction} className="mt-3">
              <Button
                className="w-full justify-start"
                size="sm"
                type="submit"
                variant="ghost"
              >
                Log out
              </Button>
            </form>
          </div>
        </aside>

        <main className="min-w-0 px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
          {children}
        </main>
      </div>
    </div>
  );
}
