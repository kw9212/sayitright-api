-- AlterTable
ALTER TABLE "Archive" ADD COLUMN     "preview" VARCHAR(200);

-- CreateIndex
CREATE INDEX "Archive_userId_createdAt_idx" ON "Archive"("userId", "createdAt" DESC);
