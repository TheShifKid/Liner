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
- **Charts:** “best of” lists (greatest ever, by year, 17 genres, 7 decades, hidden gems)
  ranked by critic score, averaged from the reviews in each album’s Wikipedia
  “Professional ratings” table; plus most-listened and Israeli & Hebrew lists from
  ListenBrainz. Rebuilt weekly (`node scripts/build-charts.mjs`)
- **Critic score** on every album page, with the reviews behind it
- **Crate:** your list of albums to hear, one click from any chart or album
- **Search:** ordered by relevance + popularity; rarely-streamed releases hidden behind “show all”
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
| `scripts/build-charts.mjs` | Builds the chart JSON files in `public/charts` |
| `lib/popularity.ts` | Listener counts from ListenBrainz |
| `lib/critic-scores.mjs` | Parses Wikipedia review tables into 0–100 critic scores |
| `lib/critics.ts` | Live critic score for any album page (Wikidata → Wikipedia) |
| `lib/stats.ts` | Everything behind /stats and /wrapped |
| `lib/urls.ts` | Every internal link and cover URL |
| `app/notes` | In-app "How Liner works" page explaining the techniques |

Each browser keeps its own separate library.
