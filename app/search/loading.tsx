export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="label">Searching MusicBrainz (one polite request per second)…</div>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="aspect-square animate-pulse bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
