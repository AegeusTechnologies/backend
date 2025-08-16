/*
  Warnings:

  - Added the required column `autoCount` to the `RunningData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `manualCount` to the `RunningData` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "RunningData" ADD COLUMN     "autoCount" INTEGER NOT NULL,
ADD COLUMN     "manualCount" INTEGER NOT NULL;
