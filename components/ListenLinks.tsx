"use client";

import { useSyncExternalStore } from "react";

// "Listen on…" links. No API keys are involved: when MusicBrainz knows the
// exact album page on a service we link straight to it; otherwise we build
// that service's *search* URL, which lands one click away from the album.

export type Service = "spotify" | "apple" | "youtube";

export const SERVICES: { key: Service; name: string; search: (q: string) => string }[] = [
  { key: "spotify", name: "Spotify", search: (q) => `https://open.spotify.com/search/${encodeURIComponent(q)}` },
  { key: "apple", name: "Apple Music", search: (q) => `https://music.apple.com/search?term=${encodeURIComponent(q)}` },
  { key: "youtube", name: "YouTube Music", search: (q) => `https://music.youtube.com/search?q=${encodeURIComponent(q)}` },
];

// ── Preferred service, remembered in this browser ────────────────────────────
// useSyncExternalStore is React's official way to read from a store React
// doesn't own (here: localStorage). It re-renders every subscriber when the
// value changes, so picking "Apple Music" once updates every track link.
const KEY = "liner.service";
const listeners = new Set<() => void>();

function readPref(): Service {
  try {
    const v = localStorage.getItem(KEY);
    return v === "apple" || v === "youtube" ? v : "spotify";
  } catch {
    return "spotify";
  }
}

function setPref(s: Service) {
  try {
    localStorage.setItem(KEY, s);
  } catch {
    /* private mode: the choice just won't be remembered */
  }
  listeners.forEach((l) => l());
}

export function usePreferredService() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readPref,
    () => "spotify" as Service, // what the server renders before the browser takes over
  );
}

// ── Album-level buttons ──────────────────────────────────────────────────────

export function AlbumListenLinks({
  artist,
  title,
  exact,
}: {
  artist: string;
  title: string;
  exact: Record<string, string>;
}) {
  const pref = usePreferredService();
  const extras = [
    exact.bandcamp && { name: "Bandcamp", url: exact.bandcamp },
    exact.tidal && { name: "Tidal", url: exact.tidal },
  ].filter(Boolean) as { name: string; url: string }[];

  return (
    <div>
      <div className="label mb-2">Listen on</div>
      <div className="flex flex-wrap gap-1.5">
        {SERVICES.map((s) => (
          <a
            key={s.key}
            href={exact[s.key] ?? s.search(`${artist} ${title}`)}
            target="_blank"
            rel="noreferrer"
            onClick={() => setPref(s.key)}
            title={exact[s.key] ? "Direct link to the album" : "Opens a search on " + s.name}
            className={`border px-3 py-1.5 text-sm font-semibold transition ${
              pref === s.key ? "border-ink bg-ink text-paper" : "border-ink/30 hover:border-ink"
            }`}
          >
            {s.name}
            {!exact[s.key] && <span className="ml-1 font-normal opacity-60">⌕</span>}
          </a>
        ))}
        {extras.map((e) => (
          <a
            key={e.name}
            href={e.url}
            target="_blank"
            rel="noreferrer"
            className="border border-ink/30 px-3 py-1.5 text-sm hover:border-ink"
          >
            {e.name}
          </a>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted">
        The dark one is your default: track links open there. ⌕ = search, no direct link known.
      </p>
    </div>
  );
}

// ── Per-track link, to the preferred service ─────────────────────────────────

export function TrackListenLink({ artist, title }: { artist: string; title: string }) {
  const pref = usePreferredService();
  const service = SERVICES.find((s) => s.key === pref)!;
  return (
    <a
      href={service.search(`${title} ${artist}`)}
      target="_blank"
      rel="noreferrer"
      aria-label={`Find ${title} on ${service.name}`}
      title={`Find on ${service.name}`}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-ink/25 text-ink-2 transition hover:border-ink hover:bg-ink hover:text-paper"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
        <path d="M2 1 L9 5 L2 9 Z" fill="currentColor" />
      </svg>
    </a>
  );
}
