"use server";

import { db, OrganizationRole, Prisma } from "@aurbit/db";
import { redirect } from "next/navigation";
import { signOut } from "../../auth";
import {
  PROJECT_MANAGE_ROLES,
  requireOrganizationMembership,
  requireProjectAccess,
  requireUser,
} from "../../lib/authorization";
import {
  generateOrganizationSlug,
  generatePublicProjectKey,
} from "../../lib/tokens";
import {
  organizationSchema,
  projectSchema,
  resourceIdSchema,
} from "../../lib/validation";

export type ResourceActionState = {
  error?: string;
  success?: string;
  fieldErrors?: { name?: string[] };
};

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function createOrganizationAction(
  _previousState: ResourceActionState,
  formData: FormData,
): Promise<ResourceActionState> {
  const parsed = organizationSchema.safeParse({ name: formData.get("name") });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const user = await requireUser();
  const organization = await db.$transaction(async (transaction) => {
    const created = await transaction.organization.create({
      data: {
        name: parsed.data.name,
        slug: generateOrganizationSlug(parsed.data.name),
        memberships: {
          create: { userId: user.id, role: OrganizationRole.OWNER },
        },
      },
      select: { id: true },
    });
    await transaction.user.update({
      where: { id: user.id },
      data: { activeOrganizationId: created.id },
      select: { id: true },
    });
    return created;
  });

  redirect(`/organizations/${organization.id}/projects`);
}

export async function switchOrganizationAction(formData: FormData) {
  const organizationId = resourceIdSchema.parse(formData.get("organizationId"));
  const { user } = await requireOrganizationMembership(organizationId);

  await db.user.update({
    where: { id: user.id },
    data: { activeOrganizationId: organizationId },
    select: { id: true },
  });

  redirect(`/organizations/${organizationId}/projects`);
}

export async function createProjectAction(
  _previousState: ResourceActionState,
  formData: FormData,
): Promise<ResourceActionState> {
  const organizationId = resourceIdSchema.parse(formData.get("organizationId"));
  const parsed = projectSchema.safeParse({ name: formData.get("name") });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await requireOrganizationMembership(organizationId, PROJECT_MANAGE_ROLES);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const project = await db.project.create({
        data: {
          organizationId,
          name: parsed.data.name,
          publicKey: generatePublicProjectKey(),
        },
        select: { id: true },
      });
      redirect(`/organizations/${organizationId}/projects/${project.id}`);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }

      throw error;
    }
  }

  return { error: "Unable to generate a unique project key. Try again." };
}

export async function updateProjectAction(
  _previousState: ResourceActionState,
  formData: FormData,
): Promise<ResourceActionState> {
  const organizationId = resourceIdSchema.parse(formData.get("organizationId"));
  const projectId = resourceIdSchema.parse(formData.get("projectId"));
  const parsed = projectSchema.safeParse({ name: formData.get("name") });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await requireProjectAccess(projectId, organizationId, PROJECT_MANAGE_ROLES);
  await db.project.update({
    where: { id: projectId },
    data: { name: parsed.data.name },
    select: { id: true },
  });

  return { success: "Project updated." };
}
