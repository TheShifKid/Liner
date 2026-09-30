-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Artist" (
    "mbid" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sortName" TEXT,
    "disambiguation" TEXT,
    "country" TEXT
);

-- CreateTable
CREATE TABLE "Album" (
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
    "deezerAlbumId" TEXT,
    "deezerCheckedAt" DATETIME,
    "artistMbid" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Album_artistMbid_fkey" FOREIGN KEY ("artistMbid") REFERENCES "Artist" ("mbid") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Track" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "albumMbid" TEXT NOT NULL,
    "recordingMbid" TEXT,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "disc" INTEGER NOT NULL DEFAULT 1,
    "number" TEXT,
    "lengthMs" INTEGER,
    "deezerTrackId" TEXT,
    CONSTRAINT "Track_albumMbid_fkey" FOREIGN KEY ("albumMbid") REFERENCES "Album" ("mbid") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SearchCache" (
    "query" TEXT NOT NULL PRIMARY KEY,
    "albumMbids" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AlbumRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "albumMbid" TEXT NOT NULL,
    "score" REAL,
    "review" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlbumRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlbumRating_albumMbid_fkey" FOREIGN KEY ("albumMbid") REFERENCES "Album" ("mbid") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrackRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "score" REAL,
    "flag" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrackRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrackRating_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RatingEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "albumMbid" TEXT NOT NULL,
    "trackId" TEXT,
    "score" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RatingEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RatingEvent_albumMbid_fkey" FOREIGN KEY ("albumMbid") REFERENCES "Album" ("mbid") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RatingEvent_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Listen" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "albumMbid" TEXT NOT NULL,
    "listenedOn" DATETIME NOT NULL,
    "relisten" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Listen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Listen_albumMbid_fkey" FOREIGN KEY ("albumMbid") REFERENCES "Album" ("mbid") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TierList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TierList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TierEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tierListId" TEXT NOT NULL,
    "albumMbid" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "TierEntry_tierListId_fkey" FOREIGN KEY ("tierListId") REFERENCES "TierList" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TierEntry_albumMbid_fkey" FOREIGN KEY ("albumMbid") REFERENCES "Album" ("mbid") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Album_artistMbid_idx" ON "Album"("artistMbid");

-- CreateIndex
CREATE INDEX "Album_year_idx" ON "Album"("year");

-- CreateIndex
CREATE INDEX "Track_albumMbid_position_idx" ON "Track"("albumMbid", "position");

-- CreateIndex
CREATE UNIQUE INDEX "AlbumRating_userId_albumMbid_key" ON "AlbumRating"("userId", "albumMbid");

-- CreateIndex
CREATE UNIQUE INDEX "TrackRating_userId_trackId_key" ON "TrackRating"("userId", "trackId");

-- CreateIndex
CREATE INDEX "RatingEvent_userId_albumMbid_createdAt_idx" ON "RatingEvent"("userId", "albumMbid", "createdAt");

-- CreateIndex
CREATE INDEX "Listen_userId_listenedOn_idx" ON "Listen"("userId", "listenedOn");

-- CreateIndex
CREATE UNIQUE INDEX "TierEntry_tierListId_albumMbid_key" ON "TierEntry"("tierListId", "albumMbid");
