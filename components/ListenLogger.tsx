"use client";

import { useState, useTransition } from "react";
import { deleteListen, logListen } from "@/app/actions";
import { btn } from "./ui";

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
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            await logListen(albumMbid, day, note);
            setNote("");
          });
        }}
      >
        <div className="flex gap-2">
          <input
            type="date"
            value={day}
            max={localToday()}
            onChange={(e) => setDay(e.target.value)}
            aria-label="Listened on"
            className="num h-9 min-w-0 flex-1 rounded-md border border-line bg-bg px-2 text-sm outline-none focus:border-line-strong"
          />
          <button disabled={pending} className={btn.primary}>
            {pending ? "Logging…" : listens.length ? "Log relisten" : "Log listen"}
          </button>
        </div>
        <input
          dir="auto"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note: where, how, first impressions… (optional)"
          aria-label="Note"
          className="h-9 w-full rounded-md border border-line bg-bg px-3 text-sm outline-none placeholder:text-muted focus:border-line-strong"
        />
      </form>

      {listens.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm">
          {listens.map((l) => (
            <li key={l.id} className="group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-surface-2">
              <span className="num shrink-0 text-xs text-text-2">
                {new Date(l.day + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>
              {l.relisten && (
                <span className="text-xs text-muted" title="Relisten">
                  ↻
                </span>
              )}
              <span dir="auto" className="min-w-0 flex-1 truncate text-xs text-muted">
                {l.note}
              </span>
              <button
                onClick={() => start(() => deleteListen(l.id))}
                className="text-xs text-muted opacity-0 hover:text-accent group-hover:opacity-100 focus-visible:opacity-100"
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
