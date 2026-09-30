-- AlterTable
ALTER TABLE "Artist" ADD COLUMN "discographyFetchedAt" DATETIME;
ALTER TABLE "Artist" ADD COLUMN "genres" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SearchCache" (
    "query" TEXT NOT NULL PRIMARY KEY,
    "albumMbids" TEXT NOT NULL,
    "artistMbids" TEXT NOT NULL DEFAULT '[]',
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_SearchCache" ("albumMbids", "fetchedAt", "query") SELECT "albumMbids", "fetchedAt", "query" FROM "SearchCache";
DROP TABLE "SearchCache";
ALTER TABLE "new_SearchCache" RENAME TO "SearchCache";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
