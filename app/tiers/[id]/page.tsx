import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TierBoard } from "@/components/TierBoard";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/user";

export const metadata: Metadata = { title: "Tier list" };

export default async function TierListPage(props: PageProps<"/tiers/[id]">) {
  const { id } = await props.params;
  const user = await currentUser();
  const list = await db.tierList.findFirst({
    where: { id, userId: user.id },
    include: { entries: { orderBy: { position: "asc" }, include: { album: true } } },
  });
  if (!list) notFound();

  const board = { S: [], A: [], B: [], C: [], D: [], pool: [] } as Record<"S" | "A" | "B" | "C" | "D" | "pool", string[]>;
  for (const e of list.entries) (board[e.tier as keyof typeof board] ?? board.pool).push(e.albumMbid);

  return (
    <TierBoard
      id={list.id}
      initialName={list.name}
      initialBoard={board}
      albums={list.entries.map((e) => ({ mbid: e.albumMbid, title: e.album.title, artistCredit: e.album.artistCredit }))}
    />
  );
}
