# Liner

A personal album-rating app, in the spirit of Album of the Year but more personal:
score every song 0–100, score the album on its own terms, and see whether the
whole beats the sum of its parts.

- **Catalogue:** MusicBrainz (millions of albums), cached locally in SQLite as you browse
- **Covers:** Cover Art Archive, with a Deezer fallback, cached on disk
- **Listen on:** exact Spotify / Apple Music / YouTube Music / Bandcamp / Tidal links
  from MusicBrainz, or a search link when none is known
- **Features:** heatmap per album · score history chart · listening diary ·
  drag-and-drop tier lists (save/share as PNG) · stats dashboard · yearly Wrapped
- **Private by design:** your ratings, reviews, diary and tier lists are stored in
  your browser (IndexedDB), never on the server. Export/Import a backup from
  the “Your data” page.

## Run it

```bash
npm install          # also generates the Prisma client
npx prisma migrate deploy   # creates data/liner.db (the catalog cache)
npm run dev          # http://localhost:3100
```

Optional `.env` settings:

```
DATABASE_URL="file:./data/liner.db"
MB_USER_AGENT="Liner/0.1 ( your-contact-url-or-email )"
```

## Where things live

| Path | What |
| --- | --- |
| `prisma/schema.prisma` | Server database: the shared MusicBrainz catalog cache only |
| `lib/local/` | Your personal data in the browser (IndexedDB via Dexie): schema, writes, live queries, backup |
| `lib/musicbrainz.ts` | Rate-limited MusicBrainz client, release picking, search ranking |
| `lib/catalog.ts` | Read-through cache on top of MusicBrainz |
| `lib/stats.ts` | Everything behind /stats and /wrapped (runs in the browser) |
| `app/notes` | In-app "How Liner works" page explaining the techniques |

Anyone can run their own copy, and each browser keeps its own separate library.
