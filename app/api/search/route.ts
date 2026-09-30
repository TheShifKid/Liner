import { searchCatalog } from "@/lib/catalog";

// JSON search, used by client components (e.g. adding albums to a tier list).
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    const { albums } = await searchCatalog(q);
    return Response.json({
      albums: albums.slice(0, 12).map((a) => ({
        mbid: a.mbid,
        title: a.title,
        artistCredit: a.artistCredit,
        year: a.year,
      })),
    });
  } catch {
    return Response.json({ albums: [], error: "MusicBrainz is unreachable right now" }, { status: 502 });
  }
}
