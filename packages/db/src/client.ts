import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";
import { PrismaClient } from "./generated/prisma/client.js";

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

export const db = globalForPrisma.aurbitPrisma ?? createPrismaClient();

globalForPrisma.aurbitPrisma = db;
