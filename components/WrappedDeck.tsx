"use client";

import { toPng } from "html-to-image";
import { BLANK } from "@/lib/urls";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Stats } from "@/lib/stats";
import { formatScore, scoreColor } from "@/lib/score";
import { CoverImage } from "./CoverImage";
import { CoverTint } from "./CoverTint";

// A story-style deck: one card on screen at a time, tap the right side (or →)
// for the next, left side (or ←) for the previous, like Instagram stories.
// Each card is a fixed 9:16 frame so a saved PNG looks like a phone story.

type Critic = { name: string; line: string } | null;
type Card = { key: string; bg: string; render: () => React.ReactNode; tintMbid?: string };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function WrappedDeck({ year, s, critic }: { year: number; s: Stats; critic: Critic }) {
  const cards = buildCards(year, s, critic);
  const [i, setI] = useState(0);
  const [saving, setSaving] = useState(false);
  const frame = useRef<HTMLDivElement>(null);

  const go = useCallback((d: number) => setI((x) => Math.min(cards.length - 1, Math.max(0, x + d))), [cards.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const save = async () => {
    if (!frame.current) return;
    setSaving(true);
    try {
      // Rendered at 3x so the 360px-wide card becomes a crisp 1080px image.
      const url = await toPng(frame.current, { pixelRatio: 3, imagePlaceholder: BLANK });
      const a = document.createElement("a");
      a.href = url;
      a.download = `liner-wrapped-${year}-${i + 1}.png`;
      a.click();
    } finally {
      setSaving(false);
    }
  };

  const card = cards[i];
  const body = (
    <div className="relative flex h-full flex-col p-7" style={{ background: card.bg }}>
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">
        <span>liner · wrapped</span>
        <span className="num">{year}</span>
      </div>
      <div className="flex flex-1 flex-col justify-center">{card.render()}</div>
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Progress segments, one per card. */}
      <div className="flex w-full max-w-[360px] gap-1">
        {cards.map((c, n) => (
          <button
            key={c.key}
            onClick={() => setI(n)}
            aria-label={`Card ${n + 1}`}
            className={`h-1 flex-1 rounded-full transition ${n <= i ? "bg-text" : "bg-line-strong"}`}
          />
        ))}
      </div>

      <div
        ref={frame}
        className="relative aspect-[9/16] w-full max-w-[360px] select-none overflow-hidden rounded-2xl text-[#fbf6ec] shadow-2xl"
      >
        {card.tintMbid ? (
          <CoverTint mbid={card.tintMbid} className="h-full [--tint:#3a332b]">
            {body}
          </CoverTint>
        ) : (
          body
        )}
        {/* Invisible tap zones (left third = back, rest = forward). */}
        <button aria-label="Previous card" onClick={() => go(-1)} className="absolute inset-y-0 left-0 w-1/3" />
        <button aria-label="Next card" onClick={() => go(1)} className="absolute inset-y-0 right-0 w-2/3" />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => go(-1)} disabled={i === 0} className="h-10 w-10 rounded-full border border-line-strong disabled:opacity-30" aria-label="Previous">
          ←
        </button>
        <span className="num w-14 text-center text-sm text-muted">
          {i + 1} / {cards.length}
        </span>
        <button onClick={() => go(1)} disabled={i === cards.length - 1} className="h-10 w-10 rounded-full border border-line-strong disabled:opacity-30" aria-label="Next">
          →
        </button>
        <button onClick={save} disabled={saving} className="ms-3 rounded-full bg-text px-4 py-2 text-sm font-semibold text-bg disabled:opacity-50">
          {saving ? "Saving…" : "Save card"}
        </button>
      </div>
    </div>
  );
}

// ── Cards ────────────────────────────────────────────────────────────────────

function Big({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`font-display font-extrabold leading-[0.9] tracking-tight ${className}`}>{children}</div>;
}

function Kicker({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] opacity-75">{children}</div>;
}

function CoverImg({ mbid, className = "" }: { mbid: string; className?: string }) {
  return <CoverImage mbid={mbid} title="" size={500} eager className={`aspect-square w-full rounded-md object-cover shadow-2xl ${className}`} />;
}

function Score({ n }: { n: number }) {
  return (
    <span className="num inline-flex h-12 min-w-16 items-center justify-center rounded-lg px-2 text-2xl font-bold text-[#10130d]" style={{ background: scoreColor(n) }}>
      {formatScore(n)}
    </span>
  );
}

const tintBg = "linear-gradient(180deg, color-mix(in oklab, var(--tint) 85%, black) 0%, color-mix(in oklab, var(--tint) 35%, #0c0b0a) 100%)";

function buildCards(year: number, s: Stats, critic: Critic): Card[] {
  const cards: Card[] = [];
  const hours = Math.round(s.counts.minutes / 60);

  cards.push({
    key: "intro",
    bg: "#ff5b35",
    render: () => (
      <>
        <Big className="text-7xl">
          {year}
          <br />
          on record.
        </Big>
        <p className="mt-6 text-lg font-medium opacity-90">
          {plural(s.counts.albums, "album")} rated, {plural(s.counts.tracks, "song")} scored, {plural(s.counts.listens, "listen")} logged.
        </p>
      </>
    ),
  });

  if (s.counts.listens > 0) {
    const peak = s.perMonth.indexOf(Math.max(...s.perMonth));
    const max = Math.max(1, ...s.perMonth);
    cards.push({
      key: "listening",
      bg: "#17140f",
      render: () => (
        <>
          <Kicker>You pressed play on</Kicker>
          <Big className="text-8xl">{s.counts.uniqueAlbumsListened}</Big>
          <div className="mt-2 text-2xl font-bold">different albums</div>
          <p className="mt-4 opacity-80">
            {s.counts.listens} listens{s.counts.relistens ? `, ${s.counts.relistens} of them relistens` : ""}
            {hours > 0 ? `. That's about ${hours} hour${hours === 1 ? "" : "s"} of music.` : "."}
          </p>
          <div className="mt-8 flex h-20 items-end gap-1">
            {s.perMonth.map((n, m) => (
              <div key={m} className="flex-1 rounded-t-[3px]" style={{ height: `${(n / max) * 100}%`, minHeight: 2, background: m === peak ? "#ff5b35" : "rgb(255 255 255 / 0.25)" }} />
            ))}
          </div>
          <div className="mt-2 text-sm opacity-70">Busiest month: {MONTHS[peak]}</div>
        </>
      ),
    });
  }

  const aoty = s.topAlbums[0];
  if (aoty) {
    cards.push({
      key: "aoty",
      bg: tintBg,
      tintMbid: aoty.album.mbid,
      render: () => (
        <>
          <Kicker>Your album of the year</Kicker>
          <CoverImg mbid={aoty.album.mbid} />
          <div className="mt-5 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <Big className="text-3xl">
                <span dir="auto">{aoty.album.title}</span>
              </Big>
              <div dir="auto" className="mt-1 opacity-80">
                {aoty.album.artistCredit}
              </div>
            </div>
            <Score n={aoty.score} />
          </div>
        </>
      ),
    });
  }

  const song = s.topTracks[0];
  if (song) {
    cards.push({
      key: "song",
      bg: tintBg,
      tintMbid: song.album.mbid,
      render: () => (
        <>
          <Kicker>Song of the year</Kicker>
          <Big className="text-5xl">
            <span dir="auto">{song.title}</span>
          </Big>
          <div dir="auto" className="mt-3 text-lg opacity-85">
            {song.album.artistCredit}
          </div>
          <div className="mt-8 flex items-center gap-4">
            <CoverImg mbid={song.album.mbid} className="!w-24" />
            <div className="min-w-0">
              <div className="text-sm opacity-70">from</div>
              <div dir="auto" className="truncate font-semibold">
                {song.album.title}
              </div>
              <div className="mt-2">
                <Score n={song.score} />
              </div>
            </div>
          </div>
        </>
      ),
    });
  }

  if (s.genres[0]) {
    cards.push({
      key: "genre",
      bg: "#1d3b2f",
      render: () => (
        <>
          <Kicker>The sound of your year</Kicker>
          <Big className="text-6xl">{s.genres[0].key}</Big>
          <ol className="mt-8 space-y-2 text-lg">
            {s.genres.slice(1, 5).map((g, n) => (
              <li key={g.key} className="flex justify-between opacity-85">
                <span>
                  <span className="num me-3 opacity-60">{n + 2}</span>
                  {g.key}
                </span>
                <span className="num opacity-70">{g.count}</span>
              </li>
            ))}
          </ol>
        </>
      ),
    });
  }

  if (s.artists[0]) {
    cards.push({
      key: "artist",
      bg: "#2a1f3d",
      render: () => (
        <>
          <Kicker>Most-rated artist</Kicker>
          <Big className="text-6xl">
            <span dir="auto">{s.artists[0].key}</span>
          </Big>
          <p className="mt-5 text-lg opacity-85">
            {s.artists[0].count} album{s.artists[0].count === 1 ? "" : "s"}, averaging{" "}
            <b className="num" style={{ color: scoreColor(s.artists[0].avg) }}>
              {formatScore(s.artists[0].avg)}
            </b>
            .
          </p>
        </>
      ),
    });
  }

  if (critic && s.avgAlbum !== null) {
    const max = Math.max(1, ...s.histogram.map((h) => h.count));
    cards.push({
      key: "critic",
      bg: "#f3ede2",
      render: () => (
        <div className="text-[#17140f]">
          <Kicker>Your critic type</Kicker>
          <Big className="text-5xl">{critic.name}</Big>
          <p className="mt-4 text-lg opacity-80">{critic.line}</p>
          <div className="mt-8 flex h-24 items-end gap-1">
            {s.histogram.map((h) => (
              <div key={h.from} className="flex-1 rounded-t-[3px]" style={{ height: `${(h.count / max) * 100}%`, minHeight: 2, background: scoreColor(h.from + 5) }} />
            ))}
          </div>
          <div className="num mt-2 flex justify-between text-xs opacity-60">
            <span>0</span>
            <span>average {formatScore(s.avgAlbum)}</span>
            <span>100</span>
          </div>
        </div>
      ),
    });
  }

  if (s.bottomAlbum && s.topAlbums.length > 1) {
    const b = s.bottomAlbum;
    cards.push({
      key: "low",
      bg: tintBg,
      tintMbid: b.album.mbid,
      render: () => (
        <>
          <Kicker>The one that didn’t land</Kicker>
          <CoverImg mbid={b.album.mbid} className="!w-40 grayscale" />
          <Big className="mt-5 text-3xl">
            <span dir="auto">{b.album.title}</span>
          </Big>
          <div dir="auto" className="mt-1 opacity-80">
            {b.album.artistCredit}
          </div>
          <div className="mt-4">
            <Score n={b.score} />
          </div>
        </>
      ),
    });
  }

  const heart = s.facts.changeOfHeart;
  if (heart) {
    cards.push({
      key: "heart",
      bg: "#3b2417",
      render: () => (
        <>
          <Kicker>Biggest change of heart</Kicker>
          <Big className="text-4xl">
            <span dir="auto">{heart.album.title}</span>
          </Big>
          <div className="mt-8 flex items-center gap-4">
            <Score n={heart.first} />
            <span className="text-3xl">→</span>
            <Score n={heart.last} />
          </div>
          <p className="mt-6 opacity-80">{heart.last > heart.first ? "It grew on you." : "It wore off."}</p>
        </>
      ),
    });
  }

  if (s.topAlbums.length >= 2) {
    cards.push({
      key: "top",
      bg: "#17140f",
      render: () => (
        <>
          <Kicker>Your top {s.topAlbums.length}</Kicker>
          <ol className="space-y-3">
            {s.topAlbums.map((t, n) => (
              <li key={t.album.mbid} className="flex items-center gap-3">
                <span className="num w-4 opacity-60">{n + 1}</span>
                <CoverImg mbid={t.album.mbid} className="!w-12 !shadow-none" />
                <div className="min-w-0 flex-1">
                  <div dir="auto" className="truncate font-semibold">
                    {t.album.title}
                  </div>
                  <div dir="auto" className="truncate text-sm opacity-70">
                    {t.album.artistCredit}
                  </div>
                </div>
                <span className="num font-bold" style={{ color: scoreColor(t.score) }}>
                  {formatScore(t.score)}
                </span>
              </li>
            ))}
          </ol>
        </>
      ),
    });
  }

  cards.push({
    key: "outro",
    bg: "#ff5b35",
    render: () => (
      <>
        <Big className="text-6xl">
          Here’s to
          <br />
          {year + 1}.
        </Big>
        <p className="mt-6 text-lg opacity-90">More records. Stranger ones, ideally.</p>
        <Link href="/" className="relative z-10 mt-8 inline-block w-fit rounded-full bg-[#17140f] px-5 py-2.5 text-sm font-semibold text-white">
          Back to your shelf
        </Link>
      </>
    ),
  });

  return cards;
}
