-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Album" (
    "mbid" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "artistCredit" TEXT NOT NULL,
    "primaryType" TEXT,
    "secondaryTypes" TEXT,
    "firstReleaseDate" TEXT,
    "year" INTEGER,
    "genres" TEXT,
    "hasCoverArt" BOOLEAN,
    "releaseMbid" TEXT,
    "tracksFetchedAt" DATETIME,
    "streamLinks" TEXT,
    "artistMbid" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Album_artistMbid_fkey" FOREIGN KEY ("artistMbid") REFERENCES "Artist" ("mbid") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Album" ("artistCredit", "artistMbid", "createdAt", "firstReleaseDate", "genres", "hasCoverArt", "mbid", "primaryType", "releaseMbid", "secondaryTypes", "title", "tracksFetchedAt", "updatedAt", "year") SELECT "artistCredit", "artistMbid", "createdAt", "firstReleaseDate", "genres", "hasCoverArt", "mbid", "primaryType", "releaseMbid", "secondaryTypes", "title", "tracksFetchedAt", "updatedAt", "year" FROM "Album";
DROP TABLE "Album";
ALTER TABLE "new_Album" RENAME TO "Album";
CREATE INDEX "Album_artistMbid_idx" ON "Album"("artistMbid");
CREATE INDEX "Album_year_idx" ON "Album"("year");
CREATE TABLE "new_Track" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "albumMbid" TEXT NOT NULL,
    "recordingMbid" TEXT,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "disc" INTEGER NOT NULL DEFAULT 1,
    "number" TEXT,
    "lengthMs" INTEGER,
    CONSTRAINT "Track_albumMbid_fkey" FOREIGN KEY ("albumMbid") REFERENCES "Album" ("mbid") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Track" ("albumMbid", "disc", "id", "lengthMs", "number", "position", "recordingMbid", "title") SELECT "albumMbid", "disc", "id", "lengthMs", "number", "position", "recordingMbid", "title" FROM "Track";
DROP TABLE "Track";
ALTER TABLE "new_Track" RENAME TO "Track";
CREATE INDEX "Track_albumMbid_position_idx" ON "Track"("albumMbid", "position");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

