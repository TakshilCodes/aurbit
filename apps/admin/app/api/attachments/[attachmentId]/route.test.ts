import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAttachment: vi.fn(),
  getBucket: vi.fn(),
  getObject: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("@aurbit/db", () => ({
  db: {
    attachment: {
      findFirst: mocks.findAttachment,
    },
  },
}));

vi.mock("../../../../lib/authorization", () => ({
  AuthenticationError: class AuthenticationError extends Error {},
  requireUser: mocks.requireUser,
}));

vi.mock("../../../../lib/report-attachment-storage", () => ({
  getReportAttachmentBucket: mocks.getBucket,
}));

import { AuthenticationError } from "../../../../lib/authorization";
import { GET } from "./route";

const context = {
  params: Promise.resolve({ attachmentId: "attachment_1" }),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue({ id: "user_1" });
  mocks.findAttachment.mockResolvedValue({
    contentType: "image/png",
    fileName: "screenshot.png",
    size: 8,
    storageKey: "bug-reports/safe-submission/safe-object.png",
  });
  mocks.getBucket.mockReturnValue({ get: mocks.getObject });
  mocks.getObject.mockResolvedValue({
    body: new Blob(["contents"]).stream(),
  });
});

describe("authenticated report attachment access", () => {
  it("returns a private attachment for an organization member", async () => {
    const response = await GET(new Request("https://admin.example"), context);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.findAttachment).toHaveBeenCalledWith({
      where: {
        id: "attachment_1",
        bugReport: {
          project: {
            organization: {
              memberships: { some: { userId: "user_1" } },
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
    expect(mocks.getObject).toHaveBeenCalledWith(
      "bug-reports/safe-submission/safe-object.png",
    );
  });

  it("does not read R2 when the attachment is outside the user's organizations", async () => {
    mocks.findAttachment.mockResolvedValue(null);

    const response = await GET(new Request("https://admin.example"), context);

    expect(response.status).toBe(404);
    expect(mocks.getBucket).not.toHaveBeenCalled();
    expect(mocks.getObject).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    mocks.requireUser.mockRejectedValue(new AuthenticationError());

    const response = await GET(new Request("https://admin.example"), context);

    expect(response.status).toBe(401);
    expect(mocks.findAttachment).not.toHaveBeenCalled();
    expect(mocks.getObject).not.toHaveBeenCalled();
  });
});
