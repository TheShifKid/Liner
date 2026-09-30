"use client";

import { useState, useTransition } from "react";
import { flagTrack, rateAlbum, rateTrack, saveReview } from "@/app/actions";
import { average, formatDuration, formatScore, scoreColor } from "@/lib/score";
import { ScoreScrubber } from "./ScoreScrubber";
import { PlayButton } from "./Player";

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
// That's called an "optimistic update": assume the save will succeed and
// show the result now, instead of waiting ~100ms for the round trip.

export function AlbumRater({
  album,
  tracks,
  initialTracks,
  initialAlbumScore,
  initialReview,
}: {
  album: { mbid: string; title: string; artistCredit: string };
  tracks: Track[];
  initialTracks: Record<string, TrackState>;
  initialAlbumScore: number | null;
  initialReview: string;
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

  const setTrack = (id: string, patch: Partial<TrackState>) =>
    setTrackState((s) => ({ ...s, [id]: { ...(s[id] ?? { score: null, flag: null }), ...patch } }));

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
      <section>
        {/* ── Heat strip: the album's shape at a glance ───────────────────── */}
        <HeatStrip tracks={tracks} get={get} totalMs={totalMs} />

        <div className="mb-2 mt-8 flex items-baseline justify-between">
          <h2 className="label">Tracklist</h2>
          <span className="label">
            {ratedCount}/{tracks.length} rated
          </span>
        </div>

        {tracks.length === 0 && (
          <p className="text-sm text-muted">MusicBrainz has no tracklist for this release yet.</p>
        )}

        <ol className="border-t border-ink">
          {tracks.map((t, i) => {
            const st = get(t.id);
            const newDisc = multiDisc && (i === 0 || tracks[i - 1].disc !== t.disc);
            return (
              <li key={t.id}>
                {newDisc && <div className="label border-b border-rule bg-paper-2 px-3 py-1.5">Disc {t.disc}</div>}
                <div
                  className={`group relative grid grid-cols-[auto_auto_1fr_auto] items-center gap-x-3 gap-y-1 border-b border-rule py-2 pl-4 pr-1 sm:grid-cols-[auto_auto_1fr_auto_auto_11rem] ${
                    st.flag === "skip" ? "opacity-55" : ""
                  }`}
                >
                  {/* The heat bar: this row's score as a color, down the left edge. */}
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-1.5 transition-colors"
                    style={{ background: scoreColor(st.score) }}
                  />
                  <span className="num w-6 text-right text-xs text-muted">{t.number ?? t.position}</span>
                  <PlayButton
                    track={{ trackId: t.id, title: t.title, artist: album.artistCredit, albumMbid: album.mbid }}
                  />
                  <span dir="auto" className="min-w-0 truncate font-medium">
                    {t.title}
                  </span>
                  <span className="num hidden text-xs text-muted sm:inline">{formatDuration(t.lengthMs)}</span>
                  <span className="flex items-center gap-0.5">
                    <FlagButton
                      kind="love"
                      active={st.flag === "love"}
                      onClick={() => {
                        const flag = st.flag === "love" ? null : "love";
                        setTrack(t.id, { flag });
                        startTransition(() => flagTrack(t.id, flag));
                      }}
                    />
                    <FlagButton
                      kind="skip"
                      active={st.flag === "skip"}
                      onClick={() => {
                        const flag = st.flag === "skip" ? null : "skip";
                        setTrack(t.id, { flag });
                        startTransition(() => flagTrack(t.id, flag));
                      }}
                    />
                  </span>
                  <div className="col-span-4 sm:col-span-1">
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
          Click or drag a bar to score · arrow keys move by 0.5 · Delete clears ·{" "}
          <span className="text-love">♥</span> love · ⏭ skip
        </p>
      </section>

      {/* ── Sidebar: the album's own score vs. the sum of its parts ─────── */}
      <aside className="space-y-8 lg:sticky lg:top-24 lg:self-start">
        <div>
          <h2 className="label mb-3">Your album score</h2>
          <ScoreScrubber
            size="lg"
            label="Album score"
            value={albumScore}
            onCommit={(v) => {
              setAlbumScore(v);
              startTransition(() => rateAlbum(album.mbid, v));
            }}
          />
          <dl className="mt-4 grid grid-cols-2 gap-px bg-rule text-sm">
            <div className="bg-paper py-2 pr-2">
              <dt className="label">Track average</dt>
              <dd className="num mt-1 text-xl font-bold">{formatScore(trackAvg, 2)}</dd>
            </div>
            <div className="bg-paper py-2 pl-3">
              <dt className="label">Whole vs parts</dt>
              <dd className="num mt-1 text-xl font-bold">
                {delta === null ? "–" : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}`}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted">
            {delta === null
              ? "Score the album and some tracks to compare."
              : Math.abs(delta) < 0.25
                ? "The album is exactly the sum of its songs."
                : delta > 0
                  ? "The album is worth more than its songs: flow, mood, sequencing."
                  : "Great songs, weaker as a whole album."}
          </p>
        </div>

        <div>
          <h2 className="label mb-2">Review</h2>
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
            rows={5}
            placeholder="A few words, if you want. Saves when you click away."
            className="w-full resize-y border border-rule bg-paper-2/50 p-3 text-sm outline-none focus:border-ink"
          />
          <div className="label h-4">{pending ? "Saving…" : review === savedReview && review ? "Saved" : ""}</div>
        </div>
      </aside>
    </div>
  );
}

function HeatStrip({ tracks, get, totalMs }: { tracks: Track[]; get: (id: string) => TrackState; totalMs: number }) {
  if (!tracks.length) return null;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="label">Heatmap</h2>
        <span className="label">{totalMs ? `${Math.round(totalMs / 60000)} min` : ""}</span>
      </div>
      {/* Each block's width is proportional to the song's length, so a
          ten-minute closer takes up the space it takes up in your evening. */}
      <div className="flex h-14 gap-0.5">
        {tracks.map((t) => {
          const st = get(t.id);
          const grow = totalMs ? (t.lengthMs ?? totalMs / tracks.length) : 1;
          return (
            <div
              key={t.id}
              title={`${t.position}. ${t.title} — ${formatScore(st.score)}`}
              className="relative min-w-1 transition-colors"
              style={{ flexGrow: grow, flexBasis: 0, background: scoreColor(st.score) }}
            >
              {st.flag === "love" && <span className="absolute left-1 top-0.5 text-[10px] text-ink">♥</span>}
              {st.flag === "skip" && (
                <span className="absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent_0_4px,var(--paper)_4px_6px)] opacity-60" />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-0.5">
        {tracks.map((t) => (
          <div
            key={t.id}
            className="num min-w-1 truncate text-[10px] text-muted"
            style={{ flexGrow: totalMs ? (t.lengthMs ?? totalMs / tracks.length) : 1, flexBasis: 0 }}
          >
            {t.position}
          </div>
        ))}
      </div>
    </div>
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
      className={`grid h-7 w-7 place-items-center transition ${
        active ? (kind === "love" ? "text-love" : "text-ink") : "text-ink/25 hover:text-ink/60"
      }`}
    >
      {kind === "love" ? (
        <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
          <path
            d="M12 21s-7.5-4.6-9.6-9.2C.9 8.5 3 4.5 6.8 4.5c2.2 0 3.7 1.2 5.2 3 1.5-1.8 3-3 5.2-3 3.8 0 5.9 4 4.4 7.3C19.5 16.4 12 21 12 21z"
            fill={active ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
          <path d="M4 5l9 7-9 7V5z" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" />
          <path d="M18 5v14" stroke="currentColor" strokeWidth="2.5" />
        </svg>
      )}
    </button>
  );
}
