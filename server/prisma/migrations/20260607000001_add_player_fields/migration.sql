-- Add missing columns to Player table
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "externalId" INTEGER;
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "position" TEXT;

-- Add unique constraint on externalId
CREATE UNIQUE INDEX IF NOT EXISTS "Player_externalId_key" ON "Player"("externalId");
