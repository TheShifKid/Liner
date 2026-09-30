"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// One shared <audio> element for the whole app, exposed through React
// Context. Context lets any component deep in the tree (a track row, a Wrapped
// card) call play() without passing props down through every layer, and
// having a single element guarantees two previews never play at once.

type NowPlaying = { trackId: string; title: string; artist: string; albumMbid: string };
type Status = "idle" | "loading" | "playing" | "paused" | "unavailable";

type PlayerApi = {
  now: NowPlaying | null;
  status: Status;
  progress: number; // 0..1
  toggle: (t: NowPlaying) => void;
  stop: () => void;
};

const Ctx = createContext<PlayerApi | null>(null);

export function usePlayer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [now, setNow] = useState<NowPlaying | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  // Guards against a race: click A, then quickly B. A's fetch may resolve
  // after B's; the token makes sure only the latest request gets to play.
  const token = useRef(0);

  useEffect(() => {
    const a = new Audio();
    a.preload = "none";
    a.addEventListener("timeupdate", () => setProgress(a.duration ? a.currentTime / a.duration : 0));
    a.addEventListener("ended", () => setStatus("paused"));
    a.addEventListener("pause", () => setStatus((s) => (s === "playing" ? "paused" : s)));
    a.addEventListener("play", () => setStatus("playing"));
    audio.current = a;
    return () => a.pause();
  }, []);

  const stop = useCallback(() => {
    audio.current?.pause();
    setNow(null);
    setStatus("idle");
  }, []);

  const toggle = useCallback(
    async (t: NowPlaying) => {
      const a = audio.current;
      if (!a) return;
      if (now?.trackId === t.trackId && status !== "unavailable") {
        if (a.paused) void a.play();
        else a.pause();
        return;
      }
      const my = ++token.current;
      a.pause();
      setNow(t);
      setStatus("loading");
      setProgress(0);
      const res = await fetch(`/api/preview/${t.trackId}`).then((r) => r.json()).catch(() => ({ url: null }));
      if (my !== token.current) return;
      if (!res.url) {
        setStatus("unavailable");
        return;
      }
      a.src = res.url;
      a.play().catch(() => setStatus("unavailable"));
    },
    [now, status],
  );

  return <Ctx.Provider value={{ now, status, progress, toggle, stop }}>{children}</Ctx.Provider>;
}

export function PlayButton({ track, className = "" }: { track: NowPlaying; className?: string }) {
  const { now, status, toggle } = usePlayer();
  const mine = now?.trackId === track.trackId;
  const playing = mine && status === "playing";
  const loading = mine && status === "loading";
  const missing = mine && status === "unavailable";
  return (
    <button
      type="button"
      onClick={() => toggle(track)}
      aria-label={playing ? `Pause ${track.title}` : `Play preview of ${track.title}`}
      title={missing ? "No preview on Deezer" : "30-second preview"}
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border border-ink/25 text-ink-2 transition hover:border-ink hover:text-ink ${
        playing ? "border-ink bg-ink text-paper hover:text-paper" : ""
      } ${missing ? "opacity-40" : ""} ${className}`}
    >
      {loading ? (
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : playing ? (
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <rect x="1" y="1" width="3" height="8" fill="currentColor" />
          <rect x="6" y="1" width="3" height="8" fill="currentColor" />
        </svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M2 1 L9 5 L2 9 Z" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}

export function MiniPlayer() {
  const { now, status, progress, toggle, stop } = usePlayer();
  if (!now) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink bg-ink text-paper">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-paper/20">
        <div className="h-full bg-paper transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <button
          onClick={() => toggle(now)}
          className="grid h-9 w-9 place-items-center rounded-full bg-paper text-ink"
          aria-label={status === "playing" ? "Pause" : "Play"}
        >
          {status === "playing" ? "❚❚" : "▶"}
        </button>
        <div className="min-w-0 flex-1">
          <div dir="auto" className="truncate font-display font-semibold">
            {now.title}
          </div>
          <div dir="auto" className="truncate text-xs text-paper/70">
            {status === "unavailable" ? "No preview available for this track" : now.artist}
          </div>
        </div>
        <span className="label hidden !text-paper/60 sm:inline">30s preview · Deezer</span>
        <button onClick={stop} className="px-2 text-paper/70 hover:text-paper" aria-label="Close player">
          ✕
        </button>
      </div>
    </div>
  );
}
