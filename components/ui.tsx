import Link from "next/link";
import { formatScore, scoreColor } from "@/lib/score";

// Small presentational pieces shared by many pages. No state and no hooks, so
// they work in both server and client components.

const BADGE = {
  xs: "h-5 min-w-6 text-[11px] rounded",
  sm: "h-7 min-w-8 text-xs rounded-md",
  md: "h-9 min-w-11 text-base rounded-md",
  lg: "h-14 min-w-16 text-2xl rounded-lg",
  xl: "h-20 min-w-24 text-4xl rounded-xl",
};

// The score tile: the score's own color as background, near-black digits
// (every color on the scale is light enough for dark text to read).
export function ScoreBadge({
  score,
  size = "md",
  title,
}: {
  score: number | null | undefined;
  size?: keyof typeof BADGE;
  title?: string;
}) {
  const none = score === null || score === undefined;
  return (
    <span
      title={title}
      className={`num inline-flex items-center justify-center px-1.5 font-bold ${BADGE[size]} ${
        none ? "border border-dashed border-line-strong text-muted" : "text-[#10130d]"
      }`}
      style={none ? undefined : { background: scoreColor(score) }}
    >
      {formatScore(score)}
    </span>
  );
}

export function Cover({
  mbid,
  title,
  size = 250,
  className = "",
  eager = false,
}: {
  mbid: string;
  title: string;
  size?: 250 | 500;
  className?: string;
  eager?: boolean;
}) {
  // A plain <img> rather than next/image: our /api/cover route already
  // resizes and caches, so there's nothing left for next/image to optimize.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/cover/${mbid}?size=${size}`}
      alt={title}
      loading={eager ? "eager" : "lazy"}
      className={`cover w-full ${className}`}
    />
  );
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
    <Link href={`/album/${album.mbid}`} className="group block">
      <div className="relative">
        <Cover
          mbid={album.mbid}
          title={album.title}
          className="transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_18px_30px_-18px_rgb(0_0_0/0.8)]"
        />
        {score !== undefined && score !== null && (
          <span className="absolute -bottom-2 end-2 shadow-lg">
            <ScoreBadge score={score} size="sm" />
          </span>
        )}
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
