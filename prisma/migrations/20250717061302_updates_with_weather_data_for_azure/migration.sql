/*
  Warnings:

  - You are about to drop the column `humidity` on the `ThresoldWeatherData` table. All the data in the column will be lost.
  - You are about to drop the column `temperature` on the `ThresoldWeatherData` table. All the data in the column will be lost.
  - You are about to drop the column `windDirection` on the `ThresoldWeatherData` table. All the data in the column will be lost.
  - You are about to drop the column `windSpeed` on the `ThresoldWeatherData` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ThresoldWeatherData" DROP COLUMN "humidity",
DROP COLUMN "temperature",
DROP COLUMN "windDirection",
DROP COLUMN "windSpeed",
ADD COLUMN     "wind_direction" TEXT,
ADD COLUMN     "wind_direction_angle" DOUBLE PRECISION,
ADD COLUMN     "wind_speed" DOUBLE PRECISION,
ADD COLUMN     "wind_speed_level" DOUBLE PRECISION,
ALTER COLUMN "rain_gauge" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Availability" (
    "id" SERIAL NOT NULL,
    "totalRobot" INTEGER NOT NULL,
    "ActiveRunRobot" INTEGER NOT NULL,
    "ActiveIdleRobot" INTEGER NOT NULL,
    "RobotActivePercentage" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);
