import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { z } from "zod";

export type ObjectStorageObject = {
  body: ReadableStream<Uint8Array>;
};

export type ObjectStorage = {
  delete(keys: readonly string[]): Promise<void>;
  get(key: string): Promise<ObjectStorageObject | null>;
  put(key: string, body: ArrayBuffer, contentType: string): Promise<void>;
};

type Environment = {
  NEXT_PUBLIC_APP_ENV?: string;
  NODE_ENV?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_ACCOUNT_ID?: string;
  R2_BUCKET_NAME?: string;
  R2_SECRET_ACCESS_KEY?: string;
};

type S3Sender = Pick<S3Client, "send">;

const r2EnvironmentSchema = z.object({
  R2_ACCESS_KEY_ID: z.string().trim().min(1),
  R2_ACCOUNT_ID: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{32}$/i),
  R2_BUCKET_NAME: z.string().trim().min(1).max(63),
  R2_SECRET_ACCESS_KEY: z.string().trim().min(1),
});

function assertSafeKey(key: string) {
  const normalized = key.replaceAll("\\", "/");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.includes("../") ||
    normalized.includes("/..") ||
    normalized.includes("\0")
  ) {
    throw new Error("Invalid object storage key");
  }
}

function localObjectPath(root: string, key: string) {
  assertSafeKey(key);
  const absoluteRoot = resolve(root);
  const objectPath = resolve(absoluteRoot, key);
  const pathFromRoot = relative(absoluteRoot, objectPath);
  if (!pathFromRoot || pathFromRoot.startsWith("..")) {
    throw new Error("Invalid object storage key");
  }
  return objectPath;
}

export function createLocalObjectStorage(root: string): ObjectStorage {
  return {
    async delete(keys) {
      await Promise.all(
        keys.map(async (key) => {
          try {
            await unlink(localObjectPath(root, key));
          } catch (error) {
            if (
              !error ||
              typeof error !== "object" ||
              !("code" in error) ||
              error.code !== "ENOENT"
            ) {
              throw error;
            }
          }
        }),
      );
    },
    async get(key) {
      try {
        const bytes = await readFile(localObjectPath(root, key));
        const body = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer;
        return { body: new Blob([body]).stream() };
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          return null;
        }
        throw error;
      }
    },
    async put(key, body) {
      const objectPath = localObjectPath(root, key);
      await mkdir(dirname(objectPath), { recursive: true });
      await writeFile(objectPath, new Uint8Array(body));
    },
  };
}

export function createR2ObjectStorage(
  environment: Pick<
    Environment,
    | "R2_ACCESS_KEY_ID"
    | "R2_ACCOUNT_ID"
    | "R2_BUCKET_NAME"
    | "R2_SECRET_ACCESS_KEY"
  >,
  sender?: S3Sender,
): ObjectStorage {
  const parsed = r2EnvironmentSchema.parse(environment);
  const config = {
    credentials: {
      accessKeyId: parsed.R2_ACCESS_KEY_ID,
      secretAccessKey: parsed.R2_SECRET_ACCESS_KEY,
    },
    endpoint: `https://${parsed.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    region: "auto",
  } satisfies S3ClientConfig;
  const client = sender ?? new S3Client(config);

  return {
    async delete(keys) {
      if (keys.length === 0) return;
      for (const key of keys) assertSafeKey(key);
      const result = await client.send(
        new DeleteObjectsCommand({
          Bucket: parsed.R2_BUCKET_NAME,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      if (result.Errors?.length) {
        throw new Error("R2 object cleanup failed");
      }
    },
    async get(key) {
      assertSafeKey(key);
      try {
        const result = await client.send(
          new GetObjectCommand({
            Bucket: parsed.R2_BUCKET_NAME,
            Key: key,
          }),
        );
        if (!result.Body) return null;
        return {
          body: result.Body.transformToWebStream() as ReadableStream<Uint8Array>,
        };
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "$metadata" in error &&
          error.$metadata &&
          typeof error.$metadata === "object" &&
          "httpStatusCode" in error.$metadata &&
          error.$metadata.httpStatusCode === 404
        ) {
          return null;
        }
        throw error;
      }
    },
    async put(key, body, contentType) {
      assertSafeKey(key);
      await client.send(
        new PutObjectCommand({
          Body: new Uint8Array(body),
          Bucket: parsed.R2_BUCKET_NAME,
          ContentType: contentType,
          Key: key,
        }),
      );
    },
  };
}

export function createObjectStorageFromEnvironment(
  environment: Environment = process.env as Environment,
  options: { localDirectory?: string; sender?: S3Sender } = {},
): ObjectStorage {
  const local =
    environment.NEXT_PUBLIC_APP_ENV === "local" ||
    (environment.NODE_ENV !== "production" &&
      environment.NEXT_PUBLIC_APP_ENV !== "staging");

  if (local) {
    return createLocalObjectStorage(
      options.localDirectory ?? resolve(process.cwd(), "../../.aurbit/storage"),
    );
  }

  return createR2ObjectStorage(
    {
      R2_ACCESS_KEY_ID: environment.R2_ACCESS_KEY_ID,
      R2_ACCOUNT_ID: environment.R2_ACCOUNT_ID,
      R2_BUCKET_NAME: environment.R2_BUCKET_NAME,
      R2_SECRET_ACCESS_KEY: environment.R2_SECRET_ACCESS_KEY,
    },
    options.sender,
  );
}
