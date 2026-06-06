-- CreateTable
CREATE TABLE "BonusLog" (
    "id"        SERIAL NOT NULL,
    "userId"    INTEGER NOT NULL,
    "points"    INTEGER NOT NULL,
    "reason"    TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BonusLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BonusLog" ADD CONSTRAINT "BonusLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
