# Liner

**Live:** https://theshifkid.github.io/Liner/

A personal album-rating app, in the spirit of Album of the Year but more personal:
score every song 0–100, score the album on its own terms, and see whether the
whole beats the sum of its parts.

- **Catalogue:** MusicBrainz (millions of albums), fetched straight from the
  browser and cached on your device as you browse
- **Covers:** Cover Art Archive
- **Listen on:** exact Spotify / Apple Music / YouTube Music / Bandcamp / Tidal links
  from MusicBrainz, or a search link when none is known
- **Features:** heatmap per album · score history chart · listening diary ·
  drag-and-drop tier lists (save/share as PNG) · stats dashboard · yearly Wrapped
- **Private by design:** there is no server. Your ratings, reviews, diary and
  tier lists are stored in your browser (IndexedDB). Export/Import a backup
  from the “Your data” page.

## Run it locally

```bash
npm install
npm run dev          # http://localhost:3100
```

`npm run build` writes the static site to `out/`. Pushing to `main` deploys it
to GitHub Pages through `.github/workflows/pages.yml`.

## Where things live

| Path | What |
| --- | --- |
| `lib/musicbrainz.ts` | Rate-limited MusicBrainz client, release picking, search ranking |
| `lib/catalog.ts` | Read-through cache of MusicBrainz data in IndexedDB |
| `lib/local/` | Your personal data in IndexedDB (via Dexie): schema, writes, live queries, backup |
| `lib/stats.ts` | Everything behind /stats and /wrapped |
| `lib/urls.ts` | Every internal link and cover URL |
| `app/notes` | In-app "How Liner works" page explaining the techniques |

Each browser keeps its own separate library.
