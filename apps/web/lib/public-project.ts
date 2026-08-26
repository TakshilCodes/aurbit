import { db, type Prisma } from "@aurbit/db";
import { z } from "zod";

const publicProjectKeySchema = z.string().regex(/^pk_proj_[a-f0-9]{24}$/);

const publicProjectSelect = {
  id: true,
  name: true,
  organizationId: true,
  publicKey: true,
  organization: {
    select: {
      name: true,
    },
  },
} satisfies Prisma.ProjectSelect;

type ResolvedPublicProject = Prisma.ProjectGetPayload<{
  select: typeof publicProjectSelect;
}>;

export type PublicProject = Readonly<{
  name: string;
  organizationName: string;
  projectKey: string;
}>;

export type PublicProjectTarget = Readonly<{
  organizationId: string;
  projectId: string;
}>;

async function findPublicProject(
  projectKey: unknown,
): Promise<ResolvedPublicProject | null> {
  const parsedKey = publicProjectKeySchema.safeParse(projectKey);

  if (!parsedKey.success) {
    return null;
  }

  return db.project.findUnique({
    where: { publicKey: parsedKey.data },
    select: publicProjectSelect,
  });
}

export async function resolvePublicProject(
  projectKey: unknown,
): Promise<PublicProject | null> {
  const project = await findPublicProject(projectKey);

  if (!project) {
    return null;
  }

  return {
    name: project.name,
    organizationName: project.organization.name,
    projectKey: project.publicKey,
  };
}

export async function resolvePublicProjectTarget(
  projectKey: unknown,
): Promise<PublicProjectTarget | null> {
  const project = await findPublicProject(projectKey);

  if (!project) {
    return null;
  }

  return {
    organizationId: project.organizationId,
    projectId: project.id,
  };
}
