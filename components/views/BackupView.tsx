"use client";

import { useEffect, useRef, useState } from "react";
import { exportBackup, importBackup, requestPersistence, wipeEverything } from "@/lib/local/backup";
import { useLibrary } from "@/lib/local/hooks";
import { btn } from "../ui";

export function BackupView() {
  const lib = useLibrary();
  const file = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  const counts = lib && [
    [lib.albumRatings.filter((r) => r.score !== null).length, "albums rated"],
    [lib.trackRatings.filter((t) => t.score !== null).length, "songs rated"],
    [lib.listens.length, "diary entries"],
    [lib.tierLists.length, "tier lists"],
  ];

  return (
    <div className="rise mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-5xl font-extrabold tracking-tight">Your data</h1>
        <p className="mt-3 leading-relaxed text-text-2">
          Your ratings, reviews, history, diary and tier lists are stored <b className="text-text">only in this browser</b>, on
          this device. Liner has no server, so they never leave your browser. That also means clearing this site’s data, or moving to a new
          phone, starts you from zero, so export a backup now and then.
        </p>
      </header>

      {counts && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {counts.map(([n, l]) => (
            <div key={l} className="rounded-xl border border-line bg-surface px-4 py-3">
              <div className="num text-2xl font-bold">{n}</div>
              <div className="label mt-1">{l}</div>
            </div>
          ))}
        </div>
      )}

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-display text-lg font-bold">Backup</h2>
        <p className="mt-1 text-sm text-text-2">One small file with everything. Import it on any device to restore.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className={btn.primary}
            onClick={async () => {
              const blob = await exportBackup();
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `liner-backup-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(a.href);
              setStatus("Backup downloaded.");
            }}
          >
            Export backup
          </button>
          <button className={btn.ghost} onClick={() => file.current?.click()}>
            Import backup…
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              if (!confirm("Importing replaces everything currently on this device with the backup. Continue?")) return;
              try {
                await importBackup(f);
                setStatus("Backup restored.");
              } catch (err) {
                setStatus((err as Error).message || "Couldn’t read that file.");
              }
            }}
          />
        </div>
        {status && <p className="mt-3 text-sm text-text-2">{status}</p>}
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-display text-lg font-bold">Keep it safe on this device</h2>
        <p className="mt-1 text-sm text-text-2">
          Browsers can clear a website’s storage when the disk runs low, unless the site has <i>persistent storage</i>.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="label">
            status: {persisted === null ? "unknown" : persisted ? "persistent ✓" : "not yet persistent"}
          </span>
          {!persisted && (
            <button className={btn.ghost} onClick={async () => setPersisted(await requestPersistence())}>
              Ask the browser to keep it
            </button>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-line p-5">
        <h2 className="font-display text-lg font-bold">Start over</h2>
        <p className="mt-1 text-sm text-text-2">Deletes all your ratings and lists from this browser. Export first if unsure.</p>
        <button
          className="mt-4 rounded-full border border-[var(--accent)] px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent hover:text-white"
          onClick={async () => {
            if (!confirm("Delete ALL your Liner data from this browser? This can't be undone.")) return;
            await wipeEverything();
            setStatus("Everything deleted from this device.");
          }}
        >
          Delete everything on this device
        </button>
      </section>
    </div>
  );
}
