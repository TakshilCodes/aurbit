import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findProject: vi.fn(),
}));

vi.mock("@aurbit/db", () => ({
  db: {
    project: {
      findUnique: mocks.findProject,
    },
  },
}));

import {
  resolvePublicProject,
  resolvePublicProjectTarget,
} from "./public-project";

const projectKey = "pk_proj_0123456789abcdef01234567";

function resolvedProject() {
  return {
    id: "project_internal",
    name: "Customer dashboard",
    organizationId: "organization_internal",
    publicKey: projectKey,
    organization: { name: "Acme" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("public project lookup", () => {
  it("resolves a valid public project key", async () => {
    mocks.findProject.mockResolvedValue(resolvedProject());

    await expect(resolvePublicProject(projectKey)).resolves.toEqual({
      name: "Customer dashboard",
      organizationName: "Acme",
      projectKey,
    });
  });

  it("fails safely without querying for malformed keys", async () => {
    await expect(resolvePublicProject("project_123")).resolves.toBeNull();
    expect(mocks.findProject).not.toHaveBeenCalled();
  });

  it("fails safely when a valid key does not exist", async () => {
    mocks.findProject.mockResolvedValue(null);

    await expect(resolvePublicProject(projectKey)).resolves.toBeNull();
  });

  it("does not expose private or admin-only project data", async () => {
    mocks.findProject.mockResolvedValue({
      ...resolvedProject(),
      organization: {
        id: "organization_internal",
        name: "Acme",
        memberships: [{ role: "OWNER", userId: "user_internal" }],
      },
    });

    const result = await resolvePublicProject(projectKey);

    expect(result).toEqual({
      name: "Customer dashboard",
      organizationName: "Acme",
      projectKey,
    });
    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("organizationId");
    expect(result).not.toHaveProperty("memberships");
  });

  it("cannot use client-supplied tenant IDs to broaden the lookup", async () => {
    await expect(
      resolvePublicProject({
        organizationId: "organization_other",
        projectKey,
      }),
    ).resolves.toBeNull();
    expect(mocks.findProject).not.toHaveBeenCalled();

    mocks.findProject.mockResolvedValue(resolvedProject());

    await resolvePublicProject(projectKey);

    expect(mocks.findProject).toHaveBeenCalledWith({
      where: { publicKey: projectKey },
      select: {
        id: true,
        name: true,
        organizationId: true,
        publicKey: true,
        organization: {
          select: {
            name: true,
          },
        },
      },
    });
  });

  it("derives the internal submission target from the public key", async () => {
    mocks.findProject.mockResolvedValue(resolvedProject());

    await expect(resolvePublicProjectTarget(projectKey)).resolves.toEqual({
      organizationId: "organization_internal",
      projectId: "project_internal",
    });
  });
});
