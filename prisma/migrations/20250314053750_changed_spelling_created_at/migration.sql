/*
  Warnings:

  - You are about to drop the column `creted_at` on the `Robot_data` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Robot_data" DROP COLUMN "creted_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
