"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { removeFromCrate } from "@/lib/local/actions";
import { useCrate } from "@/lib/local/hooks";
import { albumHref } from "@/lib/urls";
import { AlbumCard, Empty, SectionTitle } from "../ui";

// Your Crate: albums you've set aside to hear. Rating one moves it to
// "Heard", from where you can clear it out.
export function CrateView() {
  const items = useCrate();
  const router = useRouter();
  if (!items) return null;

  const toHear = items.filter((i) => i.score === null);
  const heard = items.filter((i) => i.score !== null);
  const added = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <div className="rise space-y-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl font-extrabold tracking-tight sm:text-6xl">Crate</h1>
          <p className="mt-2 max-w-xl text-text-2">
            Albums you want to hear. Dig through the{" "}
            <Link href="/charts" className="underline hover:text-text">
              charts
            </Link>{" "}
            and hit <b>+</b> on anything that catches your eye.
          </p>
        </div>
        {toHear.length > 1 && (
          <button
            onClick={() => router.push(albumHref(toHear[Math.floor(Math.random() * toHear.length)].mbid))}
            className="rounded-full bg-text px-4 py-2 text-sm font-semibold text-bg transition hover:opacity-85"
          >
            Pick one for me
          </button>
        )}
      </header>

      {items.length === 0 && <Empty>Your crate is empty. Open any album or chart and add what you want to hear next.</Empty>}

      {toHear.length > 0 && (
        <section>
          <SectionTitle>To hear · {toHear.length}</SectionTitle>
          <Grid items={toHear} sub={(i) => `added ${added(i.addedAt)}`} />
        </section>
      )}

      {heard.length > 0 && (
        <section>
          <SectionTitle
            right={
              <button onClick={() => void removeFromCrate(heard.map((h) => h.mbid))} className="label hover:text-text">
                clear heard
              </button>
            }
          >
            Heard · {heard.length}
          </SectionTitle>
          <Grid items={heard} />
        </section>
      )}
    </div>
  );
}

type Item = NonNullable<ReturnType<typeof useCrate>>[number];

function Grid({ items, sub }: { items: Item[]; sub?: (i: Item) => string }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4 lg:grid-cols-6">
      {items.map((i) => (
        <div key={i.mbid} className="group/item relative">
          <AlbumCard album={i.album} score={i.score} sub={sub && <div className="num mt-0.5 text-xs text-muted">{sub(i)}</div>} />
          <button
            onClick={() => void removeFromCrate([i.mbid])}
            aria-label={`Remove ${i.album.title} from your crate`}
            className="absolute end-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-sm text-white opacity-0 backdrop-blur transition group-hover/item:opacity-100 focus:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
