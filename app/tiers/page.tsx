import type { Metadata } from "next";
import Link from "next/link";
import { createTierList } from "@/app/actions";
import { btn, Empty } from "@/components/ui";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/user";

export const metadata: Metadata = { title: "Tier lists" };

export default async function TiersPage() {
  const user = await currentUser();
  const lists = await db.tierList.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { entries: { where: { tier: { not: "pool" } }, orderBy: [{ tier: "asc" }, { position: "asc" }], take: 6 } },
  });

  return (
    <div className="rise space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-5xl font-extrabold tracking-tight">Tier lists</h1>
        {/* A plain <form> posting to a Server Action: works even before any
            JavaScript has loaded ("progressive enhancement"). */}
        <form action={createTierList} className="flex gap-2">
          <input
            name="name"
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
          {lists.map((l) => (
            <li key={l.id}>
              <Link href={`/tiers/${l.id}`} className="group block rounded-xl border border-line bg-surface p-3 transition hover:border-line-strong">
                <div className="grid grid-cols-6 gap-0.5 overflow-hidden rounded-md bg-surface-2">
                  {Array.from({ length: 6 }, (_, i) =>
                    l.entries[i] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={`/api/cover/${l.entries[i].albumMbid}?size=250`} alt="" className="aspect-square w-full object-cover" />
                    ) : (
                      <div key={i} className="aspect-square" />
                    ),
                  )}
                </div>
                <div dir="auto" className="mt-3 font-display text-lg font-bold">
                  {l.name}
                </div>
                <div className="label">updated {l.updatedAt.toLocaleDateString("en-GB")}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
