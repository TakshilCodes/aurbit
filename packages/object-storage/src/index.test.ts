import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLocalObjectStorage, createR2ObjectStorage } from "./index";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("object storage", () => {
  it("shares local files through a deterministic directory", async () => {
    const directory = await mkdtemp(join(tmpdir(), "aurbit-storage-"));
    temporaryDirectories.push(directory);
    const writer = createLocalObjectStorage(directory);
    const reader = createLocalObjectStorage(directory);

    await writer.put(
      "bug-reports/submission/image.png",
      new Uint8Array([1, 2, 3]).buffer,
      "image/png",
    );

    const object = await reader.get("bug-reports/submission/image.png");
    await expect(new Response(object?.body).arrayBuffer()).resolves.toEqual(
      new Uint8Array([1, 2, 3]).buffer,
    );

    await writer.delete(["bug-reports/submission/image.png"]);
    await expect(
      reader.get("bug-reports/submission/image.png"),
    ).resolves.toBeNull();
  });

  it("rejects keys that could escape local storage", async () => {
    const directory = await mkdtemp(join(tmpdir(), "aurbit-storage-"));
    temporaryDirectories.push(directory);
    const storage = createLocalObjectStorage(directory);

    await expect(
      storage.put("../secret", new ArrayBuffer(0), "text/plain"),
    ).rejects.toThrow("Invalid object storage key");
  });

  it("uses private R2 S3 operations without making network calls", async () => {
    const send = vi.fn().mockResolvedValue({});
    const storage = createR2ObjectStorage(
      {
        R2_ACCESS_KEY_ID: "access-key",
        R2_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
        R2_BUCKET_NAME: "aurbit-attachments-production",
        R2_SECRET_ACCESS_KEY: "secret-key",
      },
      { send } as never,
    );

    await storage.put(
      "bug-reports/submission/image.png",
      new Uint8Array([1]).buffer,
      "image/png",
    );
    await storage.delete(["bug-reports/submission/image.png"]);

    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(PutObjectCommand);
    expect(send.mock.calls[1]?.[0]).toBeInstanceOf(DeleteObjectsCommand);
    expect(
      send.mock.calls.some(([command]) => command instanceof GetObjectCommand),
    ).toBe(false);
  });
  it("surfaces partial R2 cleanup failures", async () => {
    const send = vi.fn().mockResolvedValue({ Errors: [{ Key: "image.png" }] });
    const storage = createR2ObjectStorage(
      {
        R2_ACCESS_KEY_ID: "access-key",
        R2_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
        R2_BUCKET_NAME: "aurbit-attachments-production",
        R2_SECRET_ACCESS_KEY: "secret-key",
      },
      { send } as never,
    );

    await expect(storage.delete(["image.png"])).rejects.toThrow(
      "R2 object cleanup failed",
    );
  });
});
