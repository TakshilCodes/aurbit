import { db } from "@aurbit/db";
import {
  AuthenticationError,
  requireUser,
} from "../../../../lib/authorization";
import { getReportAttachmentBucket } from "../../../../lib/report-attachment-storage";

type RouteContext = {
  params: Promise<{ attachmentId: string }>;
};

function contentDisposition(fileName: string) {
  const asciiName = fileName
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");

  return `inline; filename="${asciiName || "attachment"}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const [{ attachmentId }, user] = await Promise.all([params, requireUser()]);
    const attachment = await db.attachment.findFirst({
      where: {
        id: attachmentId,
        bugReport: {
          project: {
            organization: {
              memberships: { some: { userId: user.id } },
            },
          },
        },
      },
      select: {
        contentType: true,
        fileName: true,
        size: true,
        storageKey: true,
      },
    });

    if (!attachment) {
      return new Response("Not found", { status: 404 });
    }

    const object = await getReportAttachmentBucket().get(attachment.storageKey);

    if (!object?.body) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(object.body, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": contentDisposition(attachment.fileName),
        "Content-Length": String(attachment.size),
        "Content-Type": attachment.contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return new Response("Unauthorized", { status: 401 });
    }

    return new Response("Unable to load attachment", { status: 500 });
  }
}
