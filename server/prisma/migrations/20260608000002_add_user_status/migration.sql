-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED');

-- AlterTable: add status column defaulting to PENDING for new rows
ALTER TABLE "User" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'PENDING';

-- All existing users were already active before this feature — mark them ACTIVE
UPDATE "User" SET "status" = 'ACTIVE';
