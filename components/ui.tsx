import Link from "next/link";
import { formatScore, scoreColor, scoreTier } from "@/lib/score";

// Small presentational pieces shared by many pages. No state, no hooks, so
// they work in both server and client components.

const tierText: Record<string, string> = {
  high: "text-[#0d2413]",
  mid: "text-[#2a2105]",
  low: "text-[#2b0a05]",
  none: "text-muted",
};

export function ScoreBadge({
  score,
  size = "md",
  title,
}: {
  score: number | null | undefined;
  size?: "sm" | "md" | "lg" | "xl";
  title?: string;
}) {
  const sizes = {
    sm: "h-7 min-w-7 text-xs",
    md: "h-10 min-w-10 text-base",
    lg: "h-16 min-w-16 text-2xl",
    xl: "h-24 min-w-24 text-4xl",
  };
  const tier = scoreTier(score);
  return (
    <span
      title={title}
      className={`num inline-flex items-center justify-center px-1 font-bold ${sizes[size]} ${tierText[tier]}`}
      style={{ background: scoreColor(score) }}
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
}: {
  mbid: string;
  title: string;
  size?: 250 | 500;
  className?: string;
}) {
  // A plain <img> rather than next/image: our /api/cover route already
  // resizes and caches, so there's nothing left for next/image to optimize.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/cover/${mbid}?size=${size}`} alt={title} loading="lazy" className={`cover w-full ${className}`} />;
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
        <Cover mbid={album.mbid} title={album.title} className="transition-transform group-hover:-translate-y-0.5" />
        {score !== undefined && score !== null && (
          <span className="absolute bottom-0 right-0">
            <ScoreBadge score={score} size="sm" />
          </span>
        )}
      </div>
      <div dir="auto" className="mt-2 truncate font-display font-semibold leading-tight">
        {album.title}
      </div>
      <div dir="auto" className="truncate text-sm text-ink-2">
        {album.artistCredit}
      </div>
      {sub ?? (album.year && <div className="num text-xs text-muted">{album.year}</div>)}
    </Link>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline gap-3">
      <h2 className="label section-rule flex-1">{children}</h2>
      {right}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="border border-dashed border-rule px-4 py-8 text-center text-sm text-muted">{children}</p>;
}
