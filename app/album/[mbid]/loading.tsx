// Shown instantly while the page's server work runs. For a never-seen album
// that's two or three polite, one-per-second calls to MusicBrainz.
export default function Loading() {
  return (
    <div className="grid gap-10 sm:grid-cols-[300px_1fr]">
      <div className="aspect-square animate-pulse bg-surface-2" />
      <div className="flex flex-col justify-end gap-3">
        <div className="label">Pulling the sleeve from MusicBrainz…</div>
        <div className="h-14 w-3/4 animate-pulse bg-surface-2" />
        <div className="h-6 w-1/3 animate-pulse bg-surface-2" />
      </div>
    </div>
  );
}
