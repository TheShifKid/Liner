import { siApplemusic, siBandcamp, siSpotify, siTidal, siYoutubemusic, type SimpleIcon } from "simple-icons";

// "Listen on" links, with each service's logo (from the Simple Icons project,
// which publishes brand marks as plain SVG paths).
//
// No API keys involved: when MusicBrainz knows the exact album page on a
// service we link straight to it; otherwise we link to that service's
// search, one click away from the album.

type Service = { key: string; name: string; icon: SimpleIcon; search?: (q: string) => string };

const SERVICES: Service[] = [
  { key: "spotify", name: "Spotify", icon: siSpotify, search: (q) => `https://open.spotify.com/search/${encodeURIComponent(q)}` },
  { key: "apple", name: "Apple Music", icon: siApplemusic, search: (q) => `https://music.apple.com/search?term=${encodeURIComponent(q)}` },
  { key: "youtube", name: "YouTube Music", icon: siYoutubemusic, search: (q) => `https://music.youtube.com/search?q=${encodeURIComponent(q)}` },
  { key: "bandcamp", name: "Bandcamp", icon: siBandcamp },
  { key: "tidal", name: "Tidal", icon: siTidal },
];

export function ListenLinks({ artist, title, exact }: { artist: string; title: string; exact: Record<string, string> }) {
  const links = SERVICES.flatMap((s) => {
    const url = exact[s.key] ?? s.search?.(`${artist} ${title}`);
    return url ? [{ ...s, url, direct: !!exact[s.key] }] : [];
  });
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <a
          key={l.key}
          href={l.url}
          target="_blank"
          rel="noreferrer"
          title={l.direct ? `Open on ${l.name}` : `Search on ${l.name}`}
          className="group inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 py-1.5 pe-3.5 ps-2.5 text-sm font-medium text-text-2 transition hover:border-line-strong hover:text-text"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
            {/* Very dark brand colors (Tidal is black) would vanish on our
                dark background, so those fall back to the text color. */}
            <path d={l.icon.path} fill={isDark(l.icon.hex) ? "currentColor" : `#${l.icon.hex}`} />
          </svg>
          {l.name}
        </a>
      ))}
    </div>
  );
}

function isDark(hex: string) {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b < 60;
}
