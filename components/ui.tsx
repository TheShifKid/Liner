import Link from "next/link";
import { albumHref } from "@/lib/urls";
import { CoverImage } from "./CoverImage";
import { MyScore } from "./MyScore";
import { ScoreBadge } from "./ScoreBadge";

export { ScoreBadge };

// Small presentational pieces shared by many pages. No state and no hooks, so
// they work in both server and client components.

export function Cover({
  mbid,
  title,
  artist = "",
  size = 250,
  className = "",
  eager = false,
}: {
  mbid: string;
  title: string;
  artist?: string;
  size?: 250 | 500;
  className?: string;
  eager?: boolean;
}) {
  return <CoverImage mbid={mbid} title={title} artist={artist} size={size} eager={eager} className={`cover w-full ${className}`} />;
}

export function AlbumCard({
  album,
  score,
  sub,
}: {
  album: { mbid: string; title: string; artistCredit: string; year: number | null };
  score?: number | null;
  sub?: React.ReactNode;
}) {
  return (
    <Link href={albumHref(album.mbid)} className="group block">
      <div className="relative">
        <Cover
          mbid={album.mbid}
          title={album.title}
          artist={album.artistCredit}
          className="transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_18px_30px_-18px_rgb(0_0_0/0.8)]"
        />
        {/* Your score lives on your device, so by default a small client
            component looks it up; pages that already know it pass `score`. */}
        <span className="absolute -bottom-2 end-2 shadow-lg">
          {score === undefined ? <MyScore mbid={album.mbid} size="sm" /> : score !== null && <ScoreBadge score={score} size="sm" />}
        </span>
      </div>
      <div dir="auto" className="mt-3 truncate text-[15px] font-semibold leading-tight">
        {album.title}
      </div>
      <div dir="auto" className="mt-0.5 truncate text-sm text-text-2">
        {album.artistCredit}
      </div>
      {sub ?? (album.year && <div className="num mt-0.5 text-xs text-muted">{album.year}</div>)}
    </Link>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3 border-b border-line pb-2">
      <h2 className="font-display text-2xl font-bold tracking-tight">{children}</h2>
      {right}
    </div>
  );
}

export function PageTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <header className="mb-10">
      <h1 className="font-display text-5xl font-extrabold tracking-tight sm:text-6xl">{children}</h1>
      {sub && <p className="mt-2 text-text-2">{sub}</p>}
    </header>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong px-6 py-12 text-center text-sm leading-relaxed text-text-2">
      {children}
    </div>
  );
}

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-full bg-text px-4 py-2 text-sm font-semibold text-bg transition hover:opacity-85 disabled:opacity-50",
  ghost:
    "inline-flex items-center justify-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm font-semibold transition hover:bg-surface-2 disabled:opacity-50",
};
