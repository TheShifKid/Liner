"use client";

import { useState, useTransition } from "react";
import { flagTrack, rateAlbum, rateTrack, saveReview } from "@/app/actions";
import { average, formatDelta, formatDuration, formatScore, scoreColor } from "@/lib/score";
import { ScoreScrubber } from "./ScoreScrubber";

type Track = {
  id: string;
  title: string;
  position: number;
  disc: number;
  number: string | null;
  lengthMs: number | null;
};
type TrackState = { score: number | null; flag: string | null };

// The interactive half of the album page. The server page loads everything
// and hands it over as props; this component keeps a local copy in state so
// the UI reacts instantly, and fires server actions in the background.
// That's an "optimistic update": assume the save succeeds and show the result
// now, instead of waiting for the round trip.

export function AlbumRater({
  album,
  tracks,
  dir,
  initialTracks,
  initialAlbumScore,
  initialReview,
  children,
}: {
  album: { mbid: string; title: string };
  tracks: Track[];
  dir: "ltr" | "rtl";
  initialTracks: Record<string, TrackState>;
  initialAlbumScore: number | null;
  initialReview: string;
  children?: React.ReactNode; // extra sidebar sections (diary, history) rendered by the server
}) {
  const [trackState, setTrackState] = useState(initialTracks);
  const [albumScore, setAlbumScore] = useState(initialAlbumScore);
  const [review, setReview] = useState(initialReview);
  const [savedReview, setSavedReview] = useState(initialReview);
  const [pending, startTransition] = useTransition();

  const get = (id: string): TrackState => trackState[id] ?? { score: null, flag: null };
  const trackAvg = average(tracks.map((t) => get(t.id).score));
  const ratedCount = tracks.filter((t) => get(t.id).score !== null).length;
  const delta = albumScore !== null && trackAvg !== null ? albumScore - trackAvg : null;
  const multiDisc = new Set(tracks.map((t) => t.disc)).size > 1;
  const totalMs = tracks.reduce((s, t) => s + (t.lengthMs ?? 0), 0);
  const loved = tracks.filter((t) => get(t.id).flag === "love").length;

  const setTrack = (id: string, patch: Partial<TrackState>) =>
    setTrackState((s) => ({ ...s, [id]: { ...(s[id] ?? { score: null, flag: null }), ...patch } }));

  const toggleFlag = (id: string, flag: "love" | "skip") => {
    const next = get(id).flag === flag ? null : flag;
    setTrack(id, { flag: next });
    startTransition(() => flagTrack(id, next));
  };

  return (
    <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section>
        <HeatStrip tracks={tracks} get={get} totalMs={totalMs} dir={dir} />

        <div className="mb-1 mt-10 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold">Tracklist</h2>
          <span className="label">
            {ratedCount} of {tracks.length} rated{loved ? ` · ${loved} loved` : ""}
          </span>
        </div>

        {tracks.length === 0 && <p className="py-6 text-sm text-muted">MusicBrainz has no tracklist for this release yet.</p>}

        <ol dir={dir}>
          {tracks.map((t, i) => {
            const st = get(t.id);
            const newDisc = multiDisc && (i === 0 || tracks[i - 1].disc !== t.disc);
            return (
              <li key={t.id}>
                {newDisc && <div className="label pb-1 pt-5">Disc {t.disc}</div>}
                <div
                  className={`group relative grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-line py-1.5 ps-3 transition-colors hover:bg-surface sm:grid-cols-[1.75rem_minmax(0,1fr)_3rem_auto_13rem] ${
                    st.flag === "skip" ? "text-muted" : ""
                  }`}
                >
                  {/* Heat bar: this row's score as a color, down the leading edge. */}
                  <span aria-hidden className="absolute inset-y-1 start-0 w-[3px] rounded-full" style={{ background: scoreColor(st.score) }} />
                  <span className="num text-end text-xs text-muted">{t.number ?? t.position}</span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={`truncate font-medium ${st.flag === "skip" ? "line-through decoration-line-strong" : ""}`}>{t.title}</span>
                    {st.flag === "love" && <Heart filled className="h-3 w-3 shrink-0 text-love" />}
                  </span>
                  <span className="num hidden text-end text-xs text-muted sm:block">{formatDuration(t.lengthMs)}</span>
                  <span className="flex items-center">
                    <FlagButton kind="love" active={st.flag === "love"} onClick={() => toggleFlag(t.id, "love")} />
                    <FlagButton kind="skip" active={st.flag === "skip"} onClick={() => toggleFlag(t.id, "skip")} />
                  </span>
                  <div className="col-span-3 pb-1 sm:col-span-1 sm:pb-0">
                    <ScoreScrubber
                      label={`Score for ${t.title}`}
                      value={st.score}
                      onCommit={(v) => {
                        setTrack(t.id, { score: v });
                        startTransition(() => rateTrack(t.id, v));
                      }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-xs text-muted">
          Drag a bar, or click a score to type it. Arrow keys ±1, with Shift ±10. Delete clears.
        </p>
      </section>

      {/* ── Sidebar: the album's own score vs. the sum of its parts ─────── */}
      <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="label mb-2">Your album score</div>
          <ScoreScrubber
            variant="hero"
            label="Album score"
            value={albumScore}
            onCommit={(v) => {
              setAlbumScore(v);
              startTransition(() => rateAlbum(album.mbid, v));
            }}
          />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Stat label="Track average" value={formatScore(trackAvg)} color={trackAvg} />
            <Stat label="Album vs tracks" value={formatDelta(delta)} />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            {delta === null
              ? "Score the album on its own terms, then its songs, and see if the whole beats the sum of its parts."
              : Math.abs(delta) < 3
                ? "Right on the sum of its songs."
                : delta > 0
                  ? "Worth more than its songs: flow, mood, sequencing."
                  : "Great songs that add up to less as an album."}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="label">Review</span>
            <span className="label">{pending ? "saving…" : review && review === savedReview ? "saved" : ""}</span>
          </div>
          <textarea
            dir="auto"
            value={review}
            onChange={(e) => setReview(e.target.value)}
            onBlur={() => {
              if (review !== savedReview) {
                setSavedReview(review);
                startTransition(() => saveReview(album.mbid, review));
              }
            }}
            rows={4}
            placeholder="A few words, if you want. Saves when you click away."
            className="w-full resize-y rounded-md border border-line bg-bg p-3 text-sm leading-relaxed outline-none placeholder:text-muted focus:border-line-strong"
          />
        </div>

        {children}
      </aside>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: number | null }) {
  return (
    <div className="rounded-lg bg-bg px-3 py-2.5">
      <div className="label">{label}</div>
      <div className="num mt-1 text-2xl font-bold" style={color != null ? { color: scoreColor(color) } : undefined}>
        {value}
      </div>
    </div>
  );
}

function HeatStrip({
  tracks,
  get,
  totalMs,
  dir,
}: {
  tracks: Track[];
  get: (id: string) => TrackState;
  totalMs: number;
  dir: "ltr" | "rtl";
}) {
  if (!tracks.length) return null;
  const grow = (t: Track) => (totalMs ? (t.lengthMs ?? totalMs / tracks.length) : 1);
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold">Heatmap</h2>
        <span className="label">{totalMs ? `${Math.round(totalMs / 60000)} min · width = song length` : ""}</span>
      </div>
      {/* Each block's width is proportional to the song's length, so a
          ten-minute closer takes the space it takes in your evening. */}
      <div dir={dir} className="flex h-12 gap-[3px]">
        {tracks.map((t) => {
          const st = get(t.id);
          return (
            <div
              key={t.id}
              title={`${t.position}. ${t.title} · ${formatScore(st.score)}`}
              className="relative min-w-1.5 overflow-hidden rounded-[3px] transition-colors"
              style={{ flexGrow: grow(t), flexBasis: 0, background: scoreColor(st.score) }}
            >
              {st.flag === "skip" && (
                <span className="absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent_0_5px,rgb(0_0_0/0.35)_5px_7px)]" />
              )}
              {st.flag === "love" && <Heart filled className="absolute start-1 top-1 h-2.5 w-2.5 text-black/60" />}
            </div>
          );
        })}
      </div>
      <div dir={dir} className="mt-1.5 flex gap-[3px]">
        {tracks.map((t) => (
          <div key={t.id} className="num min-w-1.5 truncate text-center text-[10px] text-muted" style={{ flexGrow: grow(t), flexBasis: 0 }}>
            {t.position}
          </div>
        ))}
      </div>
    </div>
  );
}

function Heart({ filled, className = "" }: { filled?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M12 21s-7.5-4.6-9.6-9.2C.9 8.5 3 4.5 6.8 4.5c2.2 0 3.7 1.2 5.2 3 1.5-1.8 3-3 5.2-3 3.8 0 5.9 4 4.4 7.3C19.5 16.4 12 21 12 21z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2.2"
      />
    </svg>
  );
}

function FlagButton({ kind, active, onClick }: { kind: "love" | "skip"; active: boolean; onClick: () => void }) {
  const label = kind === "love" ? "Love" : "Skip";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`grid h-8 w-8 place-items-center rounded-md transition ${
        active
          ? kind === "love"
            ? "text-love"
            : "text-text"
          : "text-muted opacity-0 hover:bg-surface-2 hover:text-text group-hover:opacity-100 focus-visible:opacity-100 max-sm:opacity-60"
      }`}
    >
      {kind === "love" ? (
        <Heart filled={active} className="h-4 w-4" />
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
          <path d="M5 5l9 7-9 7V5z" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M18.5 5v14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
