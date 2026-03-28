-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "description" TEXT,
    "category" TEXT,
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "quantityReserved" INTEGER NOT NULL DEFAULT 0,
    "reorderPoint" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT,
    "unitCost" REAL,
    "lastRestockedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inventoryItemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "notes" TEXT,
    "performedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_movements_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inventory_movements_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_sku_key" ON "inventory_items"("sku");
