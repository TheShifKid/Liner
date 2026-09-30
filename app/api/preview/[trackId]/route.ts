import { freshPreviewUrl } from "@/lib/deezer";

// Returns a fresh, signed 30-second preview URL from Deezer for one track.
// The browser then streams the MP3 straight from Deezer's CDN; we never store
// audio (Deezer's terms forbid offline storage).
export async function GET(_req: Request, ctx: { params: Promise<{ trackId: string }> }) {
  const { trackId } = await ctx.params;
  const url = await freshPreviewUrl(trackId).catch(() => null);
  return Response.json({ url }, { headers: { "Cache-Control": "no-store" } });
}
