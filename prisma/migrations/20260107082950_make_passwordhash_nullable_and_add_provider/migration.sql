-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authProvider" TEXT NOT NULL DEFAULT 'local',
ADD COLUMN     "authProviderId" TEXT,
ALTER COLUMN "passwordHash" DROP NOT NULL;
