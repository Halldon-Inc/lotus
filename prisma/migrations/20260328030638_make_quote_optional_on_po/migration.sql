-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_purchase_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT,
    "clientId" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedById" TEXT,
    "discrepancyNotes" TEXT,
    "scheduledDeliveryDate" DATETIME,
    "deliveryMethod" TEXT,
    "rejectionReason" TEXT,
    "rejectionCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "purchase_orders_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "purchase_orders_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "purchase_orders_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_purchase_orders" ("clientId", "createdAt", "deliveryMethod", "discrepancyNotes", "id", "poNumber", "quoteId", "receivedAt", "rejectionCount", "rejectionReason", "scheduledDeliveryDate", "status", "totalAmount", "updatedAt", "verifiedById") SELECT "clientId", "createdAt", "deliveryMethod", "discrepancyNotes", "id", "poNumber", "quoteId", "receivedAt", "rejectionCount", "rejectionReason", "scheduledDeliveryDate", "status", "totalAmount", "updatedAt", "verifiedById" FROM "purchase_orders";
DROP TABLE "purchase_orders";
ALTER TABLE "new_purchase_orders" RENAME TO "purchase_orders";
CREATE UNIQUE INDEX "purchase_orders_quoteId_key" ON "purchase_orders"("quoteId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
