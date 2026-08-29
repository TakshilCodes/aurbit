import { db } from "@aurbit/db";
import { requirePageUser } from "../../lib/page-access";
import { listPendingWorkspaceInvitesForUser } from "../../lib/workspace-invitations";
import { AdminNavigation } from "./admin-navigation";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requirePageUser();
  const [memberships, pendingInvites] = await Promise.all([
    db.organizationMember.findMany({
      where: { userId: user.id },
      orderBy: { organization: { name: "asc" } },
      select: {
        organizationId: true,
        role: true,
        organization: { select: { id: true, name: true } },
      },
    }),
    listPendingWorkspaceInvitesForUser(user.email),
  ]);
  const activeOrganizationId = memberships.some(
    ({ organizationId }) => organizationId === user.activeOrganizationId,
  )
    ? (user.activeOrganizationId ?? undefined)
    : memberships[0]?.organizationId;

  return (
    <AdminNavigation
      activeOrganizationId={activeOrganizationId}
      memberships={memberships}
      pendingInviteCount={pendingInvites.length}
      user={{ email: user.email, image: user.image, name: user.name }}
    >
      {children}
    </AdminNavigation>
  );
}
