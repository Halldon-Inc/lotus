-- AlterTable
ALTER TABLE "client_invoices" ADD COLUMN "quickbooksId" TEXT;

-- AlterTable
ALTER TABLE "clients" ADD COLUMN "quickbooksId" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "quickbooksId" TEXT;

-- CreateTable
CREATE TABLE "quickbooks_connections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "realmId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" DATETIME NOT NULL,
    "companyName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "connectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" DATETIME,
    "syncStatus" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "quickbooks_connections_realmId_key" ON "quickbooks_connections"("realmId");
