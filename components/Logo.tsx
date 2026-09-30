// The mark: a record seen from above, with one groove picked out in the
// accent color, next to a lowercase wordmark.
export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
        <circle cx="16" cy="16" r="15" fill="var(--text)" />
        <circle cx="16" cy="16" r="11" fill="none" stroke="var(--bg)" strokeOpacity="0.35" strokeWidth="0.8" />
        <path d="M16 8.5a7.5 7.5 0 0 1 7.5 7.5" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="16" cy="16" r="3.2" fill="var(--accent)" />
        <circle cx="16" cy="16" r="0.9" fill="var(--bg)" />
      </svg>
      <span className="font-display text-[22px] font-extrabold tracking-tight">liner</span>
    </span>
  );
}
