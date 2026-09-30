import { formatScore, scoreColor } from "@/lib/score";

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
