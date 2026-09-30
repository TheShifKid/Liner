import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { db } from "./db";

// Single-user mode: the first (and only) user is "you".
// When real accounts arrive, this is the ONE function that changes: it will
// read the session cookie instead. Every page and action already asks
// currentUser() rather than assuming, so nothing else has to move.
//
// React's cache() de-duplicates calls within one request, so ten components
// asking for the user cost one query.
export const currentUser = cache(async () => {
  // connection() tells Next.js "this depends on the incoming request". Without
  // it, pages like Stats would be rendered once at build time and then serve
  // frozen numbers forever. (Reading a login cookie will have the same effect.)
  await connection();
  const existing = await db.user.findFirst({ orderBy: { createdAt: "asc" } });
  return existing ?? db.user.create({ data: { name: "Me" } });
});
