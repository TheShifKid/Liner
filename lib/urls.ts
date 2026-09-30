// Every internal link and every cover URL is built here, in one place.
//
// Why query strings (/album?id=…) instead of paths (/album/…)? The site is a
// static export for GitHub Pages: every page must exist as a real HTML file
// at build time. We can't pre-build a page for each of MusicBrainz's millions
// of albums, so there is ONE album page, and it reads the id from the URL in
// the browser.

export const albumHref = (mbid: string) => `/album?id=${mbid}`;
export const artistHref = (mbid: string) => `/artist?id=${mbid}`;
export const tierListHref = (id: string) => `/tiers/edit?id=${id}`;
export const wrappedHref = (year: number) => `/wrapped?year=${year}`;
export const searchHref = (q: string) => `/search?q=${encodeURIComponent(q)}`;

// Cover Art Archive serves ready-made thumbnails for any release group. It
// sends CORS headers, so with crossOrigin="anonymous" on the <img>, covers
// can be drawn onto a <canvas> for "save as image" without "tainting" it
// (browsers lock a canvas that contains images from sites that didn't
// explicitly allow it).
export const coverUrl = (mbid: string, size: 250 | 500 = 250) =>
  `https://coverartarchive.org/release-group/${mbid}/front-${size}`;

// No art anywhere: draw a "blank sleeve" with the title set in type, colored
// by a hash of the title so every album gets its own stable color. Returned
// as a data: URL, so it needs no network at all.
export function placeholderCover(title: string, artist: string) {
  let h = 0;
  for (const ch of title + artist) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  const t = esc(title.length > 34 ? title.slice(0, 33) + "…" : title);
  const a = esc(artist.length > 40 ? artist.slice(0, 39) + "…" : artist);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <rect width="500" height="500" fill="hsl(${hue} 22% 22%)"/>
  <circle cx="250" cy="250" r="170" fill="none" stroke="hsl(${hue} 22% 30%)" stroke-width="2"/>
  <circle cx="250" cy="250" r="120" fill="none" stroke="hsl(${hue} 22% 30%)" stroke-width="2"/>
  <circle cx="250" cy="250" r="14" fill="hsl(${hue} 22% 30%)"/>
  <text x="32" y="420" font-family="Bricolage Grotesque, Rubik, sans-serif" font-size="34" font-weight="700" fill="hsl(${hue} 30% 92%)">${t}</text>
  <text x="32" y="462" font-family="JetBrains Mono, monospace" font-size="20" fill="hsl(${hue} 20% 72%)">${a}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// A 1×1 transparent image. Image exports use it in place of any cover that
// fails to download, so one flaky image can't make the whole export fail.
export const BLANK =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
