"use client";

import { useState, useTransition } from "react";
import { deleteListen, logListen } from "@/app/actions";

// Today's date as YYYY-MM-DD in the *browser's* timezone. toISOString() would
// give the UTC date, which is "yesterday" for part of every evening in Israel.
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ListenLogger({
  albumMbid,
  listens,
}: {
  albumMbid: string;
  listens: { id: string; day: string; relisten: boolean; note: string | null }[];
}) {
  const [day, setDay] = useState(localToday);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  return (
    <div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            await logListen(albumMbid, day, note);
            setNote("");
          });
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="label">Listened on</span>
          <input
            type="date"
            value={day}
            max={localToday()}
            onChange={(e) => setDay(e.target.value)}
            className="num border border-rule bg-transparent px-2 py-1.5 text-sm outline-none focus:border-ink"
          />
        </label>
        <label className="flex min-w-40 flex-1 flex-col gap-1">
          <span className="label">Note (optional)</span>
          <input
            dir="auto"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="On the train, headphones, first time through…"
            className="border border-rule bg-transparent px-2 py-1.5 text-sm outline-none focus:border-ink"
          />
        </label>
        <button
          disabled={pending}
          className="bg-ink px-4 py-2 text-sm font-semibold text-paper transition hover:opacity-85 disabled:opacity-50"
        >
          {pending ? "Logging…" : listens.length ? "Log a relisten" : "Log listen"}
        </button>
      </form>

      {listens.length > 0 && (
        <ul className="mt-4 divide-y divide-rule border-y border-rule text-sm">
          {listens.map((l) => (
            <li key={l.id} className="flex items-center gap-3 py-2">
              <span className="num w-24 shrink-0 text-ink-2">{l.day}</span>
              {l.relisten && (
                <span className="label" title="Relisten">
                  ↻
                </span>
              )}
              <span dir="auto" className="min-w-0 flex-1 truncate text-ink-2">
                {l.note}
              </span>
              <button
                onClick={() => start(() => deleteListen(l.id))}
                className="text-xs text-muted hover:text-low"
                aria-label={`Delete listen from ${l.day}`}
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
