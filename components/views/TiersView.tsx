"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createTierList } from "@/lib/local/actions";
import { local } from "@/lib/local/db";
import { useLibrary } from "@/lib/local/hooks";
import { TierBoard } from "../TierBoard";
import { btn, Empty } from "../ui";

const ORDER = ["S", "A", "B", "C", "D"];

export function TiersView() {
  const lib = useLibrary();
  const router = useRouter();
  const [name, setName] = useState("");
  if (!lib) return null;

  const lists = [...lib.tierLists].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="rise space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-5xl font-extrabold tracking-tight">Tier lists</h1>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const id = await createTierList(name);
            router.push(`/tiers/${id}`);
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            dir="auto"
            placeholder="e.g. Radiohead, ranked"
            className="h-10 w-56 rounded-full border border-line bg-surface px-4 text-sm outline-none placeholder:text-muted focus:border-line-strong"
          />
          <button className={btn.primary}>New tier list</button>
        </form>
      </header>

      {lists.length === 0 ? (
        <Empty>No tier lists yet. A new one starts with every album you’ve scored waiting in the unranked pile.</Empty>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((l) => {
            const placed = l.placements
              .filter((p) => p.tier !== "pool")
              .sort((a, b) => ORDER.indexOf(a.tier) - ORDER.indexOf(b.tier) || a.position - b.position)
              .slice(0, 6);
            return (
              <li key={l.id}>
                <Link href={`/tiers/${l.id}`} className="group block rounded-xl border border-line bg-surface p-3 transition hover:border-line-strong">
                  <div className="grid grid-cols-6 gap-0.5 overflow-hidden rounded-md bg-surface-2">
                    {Array.from({ length: 6 }, (_, i) =>
                      placed[i] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={`/api/cover/${placed[i].albumMbid}?size=250`} alt="" className="aspect-square w-full object-cover" />
                      ) : (
                        <div key={i} className="aspect-square" />
                      ),
                    )}
                  </div>
                  <div dir="auto" className="mt-3 font-display text-lg font-bold">
                    {l.name}
                  </div>
                  <div className="label">updated {new Date(l.updatedAt).toLocaleDateString("en-GB")}</div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function TierListEditor({ id }: { id: string }) {
  const list = useLiveQuery(async () => (await local.tierLists.get(id)) ?? null, [id]);
  const albums = useLiveQuery(() => local.albums.toArray());
  if (list === undefined || albums === undefined) return null;
  if (list === null) return <Empty>This tier list isn’t on this device. (Tier lists live in the browser you made them in.)</Empty>;

  const snap = new Map(albums.map((a) => [a.mbid, a]));
  const board = { S: [], A: [], B: [], C: [], D: [], pool: [] } as Record<"S" | "A" | "B" | "C" | "D" | "pool", string[]>;
  for (const p of [...list.placements].sort((a, b) => a.position - b.position)) (board[p.tier] ?? board.pool).push(p.albumMbid);

  // TierBoard keeps its own working copy while you drag (and autosaves it),
  // so it only needs the stored list once: `key` mounts it fresh per list.
  return (
    <TierBoard
      key={list.id}
      id={list.id}
      initialName={list.name}
      initialBoard={board}
      albums={list.placements.map((p) => ({
        mbid: p.albumMbid,
        title: snap.get(p.albumMbid)?.title ?? "Unknown album",
        artistCredit: snap.get(p.albumMbid)?.artistCredit ?? "",
      }))}
    />
  );
}
