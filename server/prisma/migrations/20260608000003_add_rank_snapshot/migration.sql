-- CreateTable: RankSnapshot
CREATE TABLE "RankSnapshot" (
    "id"          SERIAL       NOT NULL,
    "userId"      INTEGER      NOT NULL,
    "label"       TEXT         NOT NULL,
    "rank"        INTEGER      NOT NULL,
    "totalPoints" INTEGER      NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RankSnapshot_pkey" PRIMARY KEY ("id")
);

-- FK to User
ALTER TABLE "RankSnapshot"
    ADD CONSTRAINT "RankSnapshot_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Unique: one snapshot per user per label (upsert-safe)
CREATE UNIQUE INDEX "RankSnapshot_userId_label_key"
    ON "RankSnapshot"("userId", "label");
