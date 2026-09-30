import { promises as fs } from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { deezerCoverUrl } from "@/lib/deezer";

// Cover art proxy + disk cache.
//
// Why proxy instead of pointing <img> straight at coverartarchive.org?
//   1. Speed: after the first view the image is served from our own disk.
//   2. Fallback: when the Cover Art Archive has no art, we try Deezer.
//   3. Same-origin images: the tier-list and Wrapped "save as image" feature
//      draws covers onto a <canvas>. Browsers "taint" a canvas that contains
//      images from other origins and then refuse to export it. Serving covers
//      from our own origin sidesteps that entirely.

const DIR = path.join(process.cwd(), "data", "covers");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const RETRY_MISSING_MS = 30 * 24 * 3600 * 1000;

const imageHeaders = (type: string) => ({
  "Content-Type": type,
  "Cache-Control": "public, max-age=604800",
});

async function download(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Liner/0.1 ( personal album-rating app )" },
    signal: AbortSignal.timeout(15_000),
    redirect: "follow",
    cache: "no-store",
  });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

export async function GET(req: Request, ctx: { params: Promise<{ mbid: string }> }) {
  const { mbid } = await ctx.params;
  if (!UUID.test(mbid)) return new Response("bad id", { status: 400 });
  const size = new URL(req.url).searchParams.get("size") === "500" ? 500 : 250;

  const file = path.join(DIR, `${mbid}-${size}.jpg`);
  const missingMarker = path.join(DIR, `${mbid}.none`);
  await fs.mkdir(DIR, { recursive: true });

  const cached = await fs.readFile(file).catch(() => null);
  if (cached) return new Response(new Uint8Array(cached), { headers: imageHeaders("image/jpeg") });

  const album = await db.album.findUnique({ where: { mbid } });
  const markerAge = await fs
    .stat(missingMarker)
    .then((s) => Date.now() - s.mtimeMs)
    .catch(() => Infinity);

  if (markerAge > RETRY_MISSING_MS) {
    let img = await download(`https://coverartarchive.org/release-group/${mbid}/front-${size}`).catch(() => null);
    if (!img && album) {
      const dz = await deezerCoverUrl(album.artistCredit, album.title).catch(() => null);
      if (dz) img = await download(dz.replace(/\/\d+x\d+-/, `/${size}x${size}-`)).catch(() => null);
    }
    if (img) {
      await fs.writeFile(file, img);
      if (album && !album.hasCoverArt) await db.album.update({ where: { mbid }, data: { hasCoverArt: true } });
      return new Response(new Uint8Array(img), { headers: imageHeaders("image/jpeg") });
    }
    await fs.writeFile(missingMarker, "");
    if (album) await db.album.update({ where: { mbid }, data: { hasCoverArt: false } });
  }

  return new Response(placeholder(album?.title ?? "Untitled", album?.artistCredit ?? ""), {
    headers: { ...imageHeaders("image/svg+xml"), "Cache-Control": "public, max-age=86400" },
  });
}

// No art anywhere: draw a "blank sleeve" with the title set in type, colored by
// a hash of the title so every album gets its own stable color.
function placeholder(title: string, artist: string) {
  let h = 0;
  for (const ch of title + artist) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  const t = esc(title.length > 34 ? title.slice(0, 33) + "…" : title);
  const a = esc(artist.length > 40 ? artist.slice(0, 39) + "…" : artist);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <rect width="500" height="500" fill="oklch(0.32 0.05 ${hue})"/>
  <circle cx="250" cy="250" r="170" fill="none" stroke="oklch(0.42 0.06 ${hue})" stroke-width="2"/>
  <circle cx="250" cy="250" r="120" fill="none" stroke="oklch(0.42 0.06 ${hue})" stroke-width="2"/>
  <circle cx="250" cy="250" r="14" fill="oklch(0.42 0.06 ${hue})"/>
  <text x="32" y="420" font-family="Bricolage Grotesque, Rubik, sans-serif" font-size="34" font-weight="700" fill="oklch(0.95 0.02 ${hue})">${t}</text>
  <text x="32" y="462" font-family="JetBrains Mono, monospace" font-size="20" fill="oklch(0.8 0.04 ${hue})">${a}</text>
</svg>`;
}
