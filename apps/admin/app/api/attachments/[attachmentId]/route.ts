import { db } from "@aurbit/db";
import {
  AuthenticationError,
  requireUser,
} from "../../../../lib/authorization";
import { getReportAttachmentBucket } from "../../../../lib/report-attachment-storage";
import { reportUnexpectedError } from "../../../../lib/observability";

type RouteContext = {
  params: Promise<{ attachmentId: string }>;
};

function contentDisposition(fileName: string, download: boolean) {
  const asciiName = fileName
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");

  const disposition = download ? "attachment" : "inline";
  return `${disposition}; filename="${asciiName || "attachment"}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(request: Request, { params }: RouteContext) {
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

    const download = new URL(request.url).searchParams.get("download") === "1";

    return new Response(object.body, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": contentDisposition(
          attachment.fileName,
          download,
        ),
        "Content-Length": String(attachment.size),
        "Content-Type": attachment.contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return new Response("Unauthorized", { status: 401 });
    }

    await reportUnexpectedError("attachment_read_failed", error);
    return new Response("Unable to load attachment", { status: 500 });
  }
}
