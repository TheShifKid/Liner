"use server";

// Server Actions: functions that run on the server but can be called from
// client components like normal async functions. Next.js turns each call into
// a POST request behind the scenes. Every write in the app goes through here.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/user";
import { clampScore } from "@/lib/score";

const COALESCE_MS = 5 * 60 * 1000;

// Record a score change in the history log.
// "Coalescing": if you change the same score several times within a few
// minutes (dragging around, second-guessing), we overwrite the latest event
// instead of adding a new one. Otherwise the history chart would be full of
// noise from a single sitting.
async function recordEvent(userId: string, albumMbid: string, trackId: string | null, score: number | null) {
  const last = await db.ratingEvent.findFirst({
    where: { userId, albumMbid, trackId },
    orderBy: { createdAt: "desc" },
  });
  if (last && last.score === score) return;
  if (last && Date.now() - last.createdAt.getTime() < COALESCE_MS) {
    // If this edit brings us back to the value before the burst began, the
    // burst was a no-op: drop it entirely.
    const before = await db.ratingEvent.findFirst({
      where: { userId, albumMbid, trackId, createdAt: { lt: last.createdAt } },
      orderBy: { createdAt: "desc" },
    });
    if (before && before.score === score) {
      await db.ratingEvent.delete({ where: { id: last.id } });
    } else {
      await db.ratingEvent.update({ where: { id: last.id }, data: { score, createdAt: new Date() } });
    }
    return;
  }
  await db.ratingEvent.create({ data: { userId, albumMbid, trackId, score } });
}

const norm = (s: number | null) => (s === null ? null : clampScore(s));

export async function rateTrack(trackId: string, score: number | null) {
  const user = await currentUser();
  const track = await db.track.findUniqueOrThrow({ where: { id: trackId } });
  const s = norm(score);
  await db.trackRating.upsert({
    where: { userId_trackId: { userId: user.id, trackId } },
    create: { userId: user.id, trackId, score: s },
    update: { score: s },
  });
  await recordEvent(user.id, track.albumMbid, trackId, s);
  revalidatePath("/", "layout");
}

export async function flagTrack(trackId: string, flag: "love" | "skip" | null) {
  const user = await currentUser();
  await db.trackRating.upsert({
    where: { userId_trackId: { userId: user.id, trackId } },
    create: { userId: user.id, trackId, flag },
    update: { flag },
  });
  revalidatePath("/", "layout");
}

export async function rateAlbum(albumMbid: string, score: number | null) {
  const user = await currentUser();
  const s = norm(score);
  await db.albumRating.upsert({
    where: { userId_albumMbid: { userId: user.id, albumMbid } },
    create: { userId: user.id, albumMbid, score: s },
    update: { score: s },
  });
  await recordEvent(user.id, albumMbid, null, s);
  revalidatePath("/", "layout");
}

export async function saveReview(albumMbid: string, review: string) {
  const user = await currentUser();
  const text = review.trim().slice(0, 5000) || null;
  await db.albumRating.upsert({
    where: { userId_albumMbid: { userId: user.id, albumMbid } },
    create: { userId: user.id, albumMbid, review: text },
    update: { review: text },
  });
  revalidatePath("/", "layout");
}

// ── Diary ────────────────────────────────────────────────────────────────────

export async function logListen(albumMbid: string, day: string, note: string) {
  const user = await currentUser();
  // Store the day at noon UTC. A bare "2026-09-30" at midnight UTC would show
  // up as the 29th for anyone west of Greenwich; noon is safe everywhere.
  const listenedOn = /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T12:00:00Z`) : new Date();
  const earlier = await db.listen.count({ where: { userId: user.id, albumMbid } });
  await db.listen.create({
    data: {
      userId: user.id,
      albumMbid,
      listenedOn,
      relisten: earlier > 0,
      note: note.trim().slice(0, 1000) || null,
    },
  });
  revalidatePath("/", "layout");
}

export async function deleteListen(id: string) {
  const user = await currentUser();
  await db.listen.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/", "layout");
}

// ── Tier lists ───────────────────────────────────────────────────────────────

export async function createTierList(formData: FormData) {
  const user = await currentUser();
  const name = String(formData.get("name") ?? "").trim().slice(0, 80) || "Untitled tier list";
  const list = await db.tierList.create({ data: { userId: user.id, name } });

  // Start the pool with every album you've scored, best first, so there is
  // something to drag straight away.
  const rated = await db.albumRating.findMany({
    where: { userId: user.id, score: { not: null } },
    orderBy: { score: "desc" },
    take: 60,
  });
  await db.tierEntry.createMany({
    data: rated.map((r, i) => ({ tierListId: list.id, albumMbid: r.albumMbid, tier: "pool", position: i })),
  });
  redirect(`/tiers/${list.id}`);
}

export type TierPlacement = { albumMbid: string; tier: string; position: number };

export async function saveTierList(id: string, name: string, placements: TierPlacement[]) {
  const user = await currentUser();
  const list = await db.tierList.findFirstOrThrow({ where: { id, userId: user.id } });
  const valid = new Set(["S", "A", "B", "C", "D", "pool"]);
  await db.$transaction([
    db.tierList.update({ where: { id: list.id }, data: { name: name.trim().slice(0, 80) || list.name } }),
    db.tierEntry.deleteMany({ where: { tierListId: list.id } }),
    db.tierEntry.createMany({
      data: placements
        .filter((p) => valid.has(p.tier))
        .map((p) => ({ tierListId: list.id, albumMbid: p.albumMbid, tier: p.tier, position: p.position })),
    }),
  ]);
  revalidatePath("/tiers");
}

export async function deleteTierList(id: string) {
  const user = await currentUser();
  await db.tierList.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/tiers");
  redirect("/tiers");
}
