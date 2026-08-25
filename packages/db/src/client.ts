import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";
import { PrismaClient } from "./generated/prisma/client.ts";

const databaseUrlSchema = z
  .string()
  .min(1, "DATABASE_URL is required")
  .refine(
    (value) =>
      value.startsWith("postgresql://") || value.startsWith("postgres://"),
    "DATABASE_URL must be a PostgreSQL connection URL",
  );

function createPrismaClient() {
  const connectionString = databaseUrlSchema.parse(process.env.DATABASE_URL);
  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as typeof globalThis & {
  aurbitPrisma?: PrismaClient;
};

function getPrismaClient() {
  const client = globalForPrisma.aurbitPrisma ?? createPrismaClient();
  globalForPrisma.aurbitPrisma = client;
  return client;
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, property): unknown {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, client) as unknown;

    if (typeof value !== "function") {
      return value;
    }

    return (...arguments_: unknown[]) =>
      Reflect.apply(value, client, arguments_) as unknown;
  },
});
