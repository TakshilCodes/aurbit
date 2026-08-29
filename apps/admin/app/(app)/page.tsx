import { db } from "@aurbit/db";
import { redirect } from "next/navigation";
import { requirePageUser } from "../../lib/page-access";
import { listPendingWorkspaceInvitesForUser } from "../../lib/workspace-invitations";

export default async function AppHomePage() {
  const user = await requirePageUser();
  const memberships = await db.organizationMember.findMany({
    where: { userId: user.id },
    select: { organizationId: true },
    orderBy: { createdAt: "asc" },
  });

  if (!memberships.length) {
    const pendingInvites = await listPendingWorkspaceInvitesForUser(user.email);
    redirect(pendingInvites.length ? "/organizations" : "/organizations/new");
  }

  const activeOrganizationId = memberships.some(
    ({ organizationId }) => organizationId === user.activeOrganizationId,
  )
    ? user.activeOrganizationId
    : memberships[0]?.organizationId;

  if (!activeOrganizationId) redirect("/organizations/new");

  if (activeOrganizationId !== user.activeOrganizationId) {
    await db.user.update({
      where: { id: user.id },
      data: { activeOrganizationId },
      select: { id: true },
    });
  }

  redirect(`/organizations/${activeOrganizationId}/projects`);
}
