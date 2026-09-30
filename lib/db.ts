import "server-only";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 talks to the database through a "driver adapter": a small bridge
// to a normal Node database driver (here better-sqlite3). The URL comes from
// .env, e.g. DATABASE_URL="file:./data/liner.db".
function makeClient() {
  const url = (process.env.DATABASE_URL ?? "file:./data/liner.db").replace(/^file:/, "");
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}

// The "global singleton" pattern: in dev, Next.js re-runs modules on every
// hot reload. Without stashing the client on globalThis we would open a new
// database connection on each save until SQLite complains.
const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? makeClient();
if (process.env.NODE_ENV !== "production") g.prisma = db;
