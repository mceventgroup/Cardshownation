import { PrismaClient } from "@csn/db";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool } from "@neondatabase/serverless";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  // Neon's Pool re-emits idle client errors (e.g. Neon closing long-lived
  // WebSockets). Without a listener, Node treats 'error' as unhandled and
  // kills the whole Lambda. See digest 1942385297, 2026-04-21.
  pool.on("error", (err) => {
    console.error("[neon pool] non-fatal idle client error:", err);
  });
  const adapter = new PrismaNeon(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : [],
  });
}

export const db = globalForPrisma.prisma ?? createClient();
globalForPrisma.prisma = db;
