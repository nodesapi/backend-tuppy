/*
  Warnings:

  - You are about to drop the column `amount` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `itemName` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `productType` on the `Order` table. All the data in the column will be lost.
  - Added the required column `grandTotal` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Made the column `customerPhone` on table `Order` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "internalNote" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'BOOKING';

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "amount",
DROP COLUMN "itemName",
DROP COLUMN "productType",
ADD COLUMN     "channel" TEXT NOT NULL DEFAULT 'DIRECT',
ADD COLUMN     "grandTotal" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "internalNote" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paymentGateway" TEXT,
ADD COLUMN     "shippingAddress" TEXT,
ADD COLUMN     "waSent" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "customerEmail" DROP NOT NULL,
ALTER COLUMN "customerPhone" SET NOT NULL,
ALTER COLUMN "platformFee" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "pgApiKey" TEXT,
ADD COLUMN     "pgProvider" TEXT,
ADD COLUMN     "waNotifEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "waPhoneNumber" TEXT;

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "blockId" TEXT,
    "productName" TEXT NOT NULL,
    "imageUrl" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
