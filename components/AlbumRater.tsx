"use client";

import { useState } from "react";
import type { AlbumSnap } from "@/lib/local/db";
import { flagTrack, rateAlbum, rateTrack, saveReview } from "@/lib/local/actions";
import { useAlbumLocal } from "@/lib/local/hooks";
import { average, formatDelta, formatDuration, formatScore, scoreColor } from "@/lib/score";
import { AlbumHistory } from "./AlbumHistory";
import { ListenLogger } from "./ListenLogger";
import { ScoreScrubber } from "./ScoreScrubber";

type Track = {
  key: string; // "albumMbid:position", the stable id your ratings are stored under
  title: string;
  position: number;
  disc: number;
  number: string | null;
  lengthMs: number | null;
};
type TrackState = { score: number | null; flag: string | null };

// The interactive half of the album page. The server sends the catalog data
// (tracklist etc.) as props; your own scores come from the browser's
// database through a live query, and every change is written straight back
// to it. Because live queries re-render within milliseconds, the screen
// reads directly from the database: there's no second copy of the state to
// keep in sync.

export function AlbumRater({
  snap,
  tracks,
  dir,
}: {
  snap: AlbumSnap;
  tracks: Track[];
  dir: "ltr" | "rtl";
}) {
  const data = useAlbumLocal(snap.mbid);
  const album = snap;

  const byKey = new Map((data?.trackRatings ?? []).map((r) => [r.key, r]));
  const get = (key: string): TrackState => byKey.get(key) ?? { score: null, flag: null };
  const albumScore = data?.rating?.score ?? null;
  const trackAvg = average(tracks.map((t) => get(t.key).score));
  const ratedCount = tracks.filter((t) => get(t.key).score !== null).length;
  const delta = albumScore !== null && trackAvg !== null ? albumScore - trackAvg : null;
  const multiDisc = new Set(tracks.map((t) => t.disc)).size > 1;
  const totalMs = tracks.reduce((s, t) => s + (t.lengthMs ?? 0), 0);
  const skipped = tracks.filter((t) => get(t.key).flag === "skip").length;

  const toggleSkip = (t: Track) => flagTrack(snap, t, get(t.key).flag === "skip" ? null : "skip");

  return (
    <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section>
        <HeatStrip tracks={tracks} get={get} totalMs={totalMs} dir={dir} />

        <div className="mb-1 mt-10 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold">Tracklist</h2>
          <span className="label">
            {ratedCount} of {tracks.length} rated{skipped ? ` · ${skipped} skipped` : ""}
          </span>
        </div>

        {tracks.length === 0 && <p className="py-6 text-sm text-muted">MusicBrainz has no tracklist for this release yet.</p>}

        <ol dir={dir}>
          {tracks.map((t, i) => {
            const st = get(t.key);
            const newDisc = multiDisc && (i === 0 || tracks[i - 1].disc !== t.disc);
            return (
              <li key={t.key}>
                {newDisc && <div className="label pb-1 pt-5">Disc {t.disc}</div>}
                <div
                  className={`group relative grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-line py-1.5 ps-3 transition-colors hover:bg-surface sm:grid-cols-[1.75rem_minmax(0,1fr)_3rem_auto_13rem] ${
                    st.flag === "skip" ? "text-muted" : ""
                  }`}
                >
                  {/* Heat bar: this row's score as a color, down the leading edge. */}
                  <span aria-hidden className="absolute inset-y-1 start-0 w-[3px] rounded-full" style={{ background: scoreColor(st.score) }} />
                  <span className="num text-end text-xs text-muted">{t.number ?? t.position}</span>
                  <span className={`min-w-0 truncate font-medium ${st.flag === "skip" ? "line-through decoration-line-strong" : ""}`}>
                    {t.title}
                  </span>
                  <span className="num hidden text-end text-xs text-muted sm:block">{formatDuration(t.lengthMs)}</span>
                  <SkipButton active={st.flag === "skip"} onClick={() => toggleSkip(t)} />
                  <div className="col-span-3 pb-1 sm:col-span-1 sm:pb-0">
                    <ScoreScrubber
                      label={`Score for ${t.title}`}
                      value={st.score}
                      onCommit={(v) => rateTrack(snap, t, v)}
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
            onCommit={(v) => rateAlbum(snap, v)}
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

        {/* Keyed on load, so the textarea starts from the saved review once
            the database has answered, then is yours to edit. */}
        {data && <ReviewBox key="loaded" snap={snap} initial={data.rating?.review ?? ""} />}

        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="label mb-3">Diary</div>
          <ListenLogger snap={snap} listens={data?.listens ?? []} />
        </div>

        {data && data.events.length > 0 && (
          <AlbumHistory events={data.events} titles={new Map(tracks.map((t) => [t.key, t.title]))} />
        )}

        <a
          className="label block text-center hover:text-text"
          href={`https://musicbrainz.org/release-group/${album.mbid}`}
          target="_blank"
          rel="noreferrer"
        >
          View on MusicBrainz ↗
        </a>
      </aside>
    </div>
  );
}

function ReviewBox({ snap, initial }: { snap: AlbumSnap; initial: string }) {
  const [review, setReview] = useState(initial);
  const [saved, setSaved] = useState(initial);
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="label">Review</span>
        <span className="label">{review && review === saved ? "saved on this device" : ""}</span>
      </div>
      <textarea
        dir="auto"
        value={review}
        onChange={(e) => setReview(e.target.value)}
        onBlur={async () => {
          if (review !== saved) {
            await saveReview(snap, review);
            setSaved(review);
          }
        }}
        rows={4}
        placeholder="A few words, if you want. Saves when you click away."
        className="w-full resize-y rounded-md border border-line bg-bg p-3 text-sm leading-relaxed outline-none placeholder:text-muted focus:border-line-strong"
      />
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
          const st = get(t.key);
          return (
            <div
              key={t.key}
              title={`${t.position}. ${t.title} · ${formatScore(st.score)}`}
              className="relative min-w-1.5 overflow-hidden rounded-[3px] transition-colors"
              style={{ flexGrow: grow(t), flexBasis: 0, background: scoreColor(st.score) }}
            >
              {st.flag === "skip" && (
                <span className="absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent_0_5px,rgb(0_0_0/0.35)_5px_7px)]" />
              )}
            </div>
          );
        })}
      </div>
      <div dir={dir} className="mt-1.5 flex gap-[3px]">
        {tracks.map((t) => (
          <div key={t.key} className="num min-w-1.5 truncate text-center text-[10px] text-muted" style={{ flexGrow: grow(t), flexBasis: 0 }}>
            {t.position}
          </div>
        ))}
      </div>
    </div>
  );
}

// Mark a track as one you skip. Skipped tracks still count in the average if
// you scored them; the mark is about listening habits, not quality.
function SkipButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label="Skip"
      title={active ? "Unmark skip" : "Mark as a skip"}
      className={`grid h-8 w-8 place-items-center rounded-md transition ${
        active
          ? "text-text"
          : "text-muted opacity-0 hover:bg-surface-2 hover:text-text group-hover:opacity-100 focus-visible:opacity-100 max-sm:opacity-60"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
        <path d="M5 5l9 7-9 7V5z" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M18.5 5v14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </button>
  );
}
