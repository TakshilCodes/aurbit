import { resolvePublicProject } from "../../../../../lib/public-project";

type RouteContext = {
  params: Promise<{ projectKey: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { projectKey } = await params;
  const project = await resolvePublicProject(projectKey);

  if (!project) {
    return Response.json({ error: "Project not found." }, { status: 404 });
  }

  return Response.json({ project });
}
