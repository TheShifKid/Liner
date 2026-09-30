"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toPng } from "html-to-image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { deleteTierList, saveSnapshot, saveTierList } from "@/lib/local/actions";
import { scoreColor } from "@/lib/score";
import { btn } from "./ui";

// Drag-and-drop tier list, built on dnd-kit.
//
// The model is a dictionary of "containers" (S, A, B, C, D, pool), each an
// ordered array of album IDs. Dragging does two things:
//   • onDragOver: while hovering a *different* container, move the item there
//     live, so the row opens a gap and you see where it will land.
//   • onDragEnd: inside one container, reorder with arrayMove.
// This two-phase pattern is the standard way to do "sortable across lists".

type Album = { mbid: string; title: string; artistCredit: string };
const TIERS = ["S", "A", "B", "C", "D"] as const;
type Container = (typeof TIERS)[number] | "pool";
type Board = Record<Container, string[]>;

// Tier label colors borrow the score scale, so S reads like a 10 and D like a 2.
const TIER_SCORE: Record<string, number> = { S: 100, A: 80, B: 60, C: 45, D: 20 };

export function TierBoard({
  id,
  initialName,
  initialBoard,
  albums: initialAlbums,
}: {
  id: string;
  initialName: string;
  initialBoard: Board;
  albums: Album[];
}) {
  const [board, setBoard] = useState<Board>(initialBoard);
  const [name, setName] = useState(initialName);
  const [albums, setAlbums] = useState(() => new Map(initialAlbums.map((a) => [a.mbid, a])));
  const [active, setActive] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving">("saved");
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  const router = useRouter();

  // Sensors decide what counts as "starting a drag". The small distance/delay
  // stops an ordinary click or a scroll on a phone from grabbing a cover.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Autosave, "debounced": wait until you've stopped changing things for
  // 800ms, then save once. Each change resets the timer.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSaveState("dirty");
    const t = setTimeout(async () => {
      setSaveState("saving");
      const placements = (Object.keys(board) as Container[]).flatMap((tier) =>
        board[tier].map((albumMbid, position) => ({ albumMbid, tier, position })),
      );
      await saveTierList(id, name, placements);
      setSaveState("saved");
    }, 800);
    return () => clearTimeout(t);
  }, [board, name, id]);

  const containerOf = (itemId: string): Container | undefined => {
    if (itemId in board) return itemId as Container;
    return (Object.keys(board) as Container[]).find((c) => board[c].includes(itemId));
  };

  const onDragStart = (e: DragStartEvent) => setActive(String(e.active.id));

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = containerOf(String(active.id));
    const to = containerOf(String(over.id));
    if (!from || !to || from === to) return;
    setBoard((b) => {
      const target = b[to];
      const overIndex = target.indexOf(String(over.id));
      const insertAt = overIndex >= 0 ? overIndex : target.length;
      return {
        ...b,
        [from]: b[from].filter((x) => x !== active.id),
        [to]: [...target.slice(0, insertAt), String(active.id), ...target.slice(insertAt)],
      };
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActive(null);
    if (!over) return;
    const c = containerOf(String(active.id));
    if (!c || c !== containerOf(String(over.id))) return;
    const oldI = board[c].indexOf(String(active.id));
    const newI = board[c].indexOf(String(over.id));
    if (newI >= 0 && oldI !== newI) setBoard((b) => ({ ...b, [c]: arrayMove(b[c], oldI, newI) }));
  };

  const addAlbum = (a: Album & { year?: number | null }) => {
    if (containerOf(a.mbid)) return;
    // Remember the album's name on this device so the list can show it later.
    void saveSnapshot({
      mbid: a.mbid,
      title: a.title,
      artistCredit: a.artistCredit,
      artistMbid: null,
      year: a.year ?? null,
      primaryType: null,
      genres: [],
      tracks: [],
      savedAt: 0,
    });
    setAlbums((m) => new Map(m).set(a.mbid, a));
    setBoard((b) => ({ ...b, pool: [a.mbid, ...b.pool] }));
  };

  const removeAlbum = (mbid: string) =>
    setBoard((b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.filter((x) => x !== mbid)])) as Board);

  // Render the tiers (not the pool) to a PNG. html-to-image clones the DOM
  // into an SVG <foreignObject>, paints that onto a canvas, and reads the
  // pixels back out. It only works because covers are same-origin (see
  // app/api/cover), otherwise the canvas would be "tainted" and locked.
  const exportImage = async (share: boolean) => {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      const bg = getComputedStyle(document.body).backgroundColor;
      const dataUrl = await toPng(exportRef.current, { pixelRatio: 2, backgroundColor: bg, cacheBust: false });
      const fileName = `${name.replace(/[^\p{L}\p{N}]+/gu, "-") || "tier-list"}.png`;
      if (share) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], fileName, { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: name });
          return;
        }
      }
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = fileName;
      a.click();
    } catch (err) {
      if ((err as Error).name !== "AbortError") alert("Couldn’t create the image: " + (err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <input
          dir="auto"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Tier list name"
          className="min-w-0 flex-1 border-b border-transparent bg-transparent font-display text-4xl font-extrabold tracking-tight outline-none hover:border-line focus:border-text"
        />
        <span className="label w-16">{saveState === "saved" ? "saved" : "saving…"}</span>
        <button onClick={() => exportImage(false)} disabled={exporting} className={btn.ghost}>
          {exporting ? "Rendering…" : "Save as image"}
        </button>
        <button onClick={() => exportImage(true)} disabled={exporting} className={btn.primary}>
          Share
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActive(null)}
      >
        <div ref={exportRef} className="bg-bg p-3">
          <div className="overflow-hidden rounded-lg border border-line">
            {TIERS.map((t) => (
              <TierRow key={t} tier={t} items={board[t]} albums={albums} onRemove={removeAlbum} />
            ))}
          </div>
          <div className="label mt-2 flex justify-between">
            <span dir="auto">{name}</span>
            <span>liner.</span>
          </div>
        </div>

        <section>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="label">Unranked · drag covers up into a tier</h2>
            <AddAlbum onAdd={addAlbum} />
          </div>
          <Pool items={board.pool} albums={albums} onRemove={removeAlbum} />
        </section>

        {/* The DragOverlay renders a floating copy of the cover under the
            pointer, so the original can stay in place as a placeholder. */}
        <DragOverlay>{active && albums.get(active) ? <CoverTile album={albums.get(active)!} lifted /> : null}</DragOverlay>
      </DndContext>

      <button
        onClick={async () => {
          if (!confirm("Delete this tier list?")) return;
          await deleteTierList(id);
          router.push("/tiers");
        }}
        className="text-xs text-muted underline hover:text-accent"
      >
        Delete tier list
      </button>
    </div>
  );
}

function TierRow({
  tier,
  items,
  albums,
  onRemove,
}: {
  tier: string;
  items: string[];
  albums: Map<string, Album>;
  onRemove: (id: string) => void;
}) {
  // useDroppable makes the whole row a drop target, which matters when the
  // row is empty and has no sortable items to drop "onto".
  const { setNodeRef, isOver } = useDroppable({ id: tier });
  return (
    <div className="flex min-h-[92px] border-b border-line bg-surface last:border-b-0">
      <div
        className="num grid w-16 shrink-0 place-items-center text-3xl font-bold text-[#1a1407] sm:w-20"
        style={{ background: scoreColor(TIER_SCORE[tier]) }}
      >
        {tier}
      </div>
      <SortableContext id={tier} items={items} strategy={rectSortingStrategy}>
        <div ref={setNodeRef} className={`flex flex-1 flex-wrap content-start gap-1 p-1 ${isOver ? "bg-surface-2" : ""}`}>
          {items.map((id) => albums.get(id) && <SortableCover key={id} album={albums.get(id)!} onRemove={onRemove} />)}
        </div>
      </SortableContext>
    </div>
  );
}

function Pool({ items, albums, onRemove }: { items: string[]; albums: Map<string, Album>; onRemove: (id: string) => void }) {
  const { setNodeRef } = useDroppable({ id: "pool" });
  return (
    <SortableContext id="pool" items={items} strategy={rectSortingStrategy}>
      <div ref={setNodeRef} className="flex min-h-[96px] flex-wrap gap-1 rounded-lg border border-dashed border-line-strong p-1">
        {items.length === 0 && <p className="m-auto text-sm text-muted">Empty. Add albums with the search above.</p>}
        {items.map((id) => albums.get(id) && <SortableCover key={id} album={albums.get(id)!} onRemove={onRemove} />)}
      </div>
    </SortableContext>
  );
}

function SortableCover({ album, onRemove }: { album: Album; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: album.mbid });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative ${isDragging ? "opacity-30" : ""}`}
      {...attributes}
      {...listeners}
    >
      <CoverTile album={album} />
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onRemove(album.mbid)}
        className="absolute right-0.5 top-0.5 hidden h-5 w-5 rounded-full bg-black/70 text-[10px] text-white group-hover:block"
        aria-label={`Remove ${album.title}`}
      >
        ✕
      </button>
    </div>
  );
}

function CoverTile({ album, lifted = false }: { album: Album; lifted?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/cover/${album.mbid}?size=250`}
      alt={`${album.title} — ${album.artistCredit}`}
      title={`${album.title} — ${album.artistCredit}`}
      draggable={false}
      className={`h-[84px] w-[84px] cursor-grab rounded-[3px] touch-none select-none object-cover ${lifted ? "scale-105 cursor-grabbing shadow-xl" : ""}`}
    />
  );
}

function AddAlbum({ onAdd }: { onAdd: (a: Album) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Album[] | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="relative w-full max-w-xs">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!q.trim()) return;
          setBusy(true);
          const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`).then((r) => r.json()).catch(() => ({ albums: [] }));
          setResults(res.albums);
          setBusy(false);
        }}
      >
        <input
          dir="auto"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={busy ? "Searching…" : "Add any album…"}
          className="h-9 w-full rounded-full border border-line bg-surface px-4 text-sm outline-none placeholder:text-muted focus:border-line-strong"
        />
      </form>
      {results && (
        <ul className="absolute right-0 z-20 mt-1 max-h-80 w-80 overflow-auto rounded-lg border border-line-strong bg-surface shadow-2xl">
          {results.length === 0 && <li className="p-3 text-sm text-muted">No matches.</li>}
          {results.map((a) => (
            <li key={a.mbid}>
              <button
                onClick={() => {
                  onAdd(a);
                  setResults(null);
                  setQ("");
                }}
                className="flex w-full items-center gap-2 p-2 text-left hover:bg-surface-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/cover/${a.mbid}?size=250`} alt="" className="h-9 w-9 object-cover" />
                <span className="min-w-0">
                  <span dir="auto" className="block truncate text-sm font-semibold">{a.title}</span>
                  <span dir="auto" className="block truncate text-xs text-text-2">{a.artistCredit}</span>
                </span>
              </button>
            </li>
          ))}
          <li>
            <button onClick={() => setResults(null)} className="label w-full p-2 text-center hover:bg-surface-2">
              close
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
