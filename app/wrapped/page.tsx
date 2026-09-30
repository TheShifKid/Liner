import { redirect } from "next/navigation";
import { connection } from "next/server";

// /wrapped always opens the current year; older years are linked from there.
export default async function WrappedIndex() {
  await connection(); // "current year" must be decided per request, not at build time
  redirect(`/wrapped/${new Date().getFullYear()}`);
}
