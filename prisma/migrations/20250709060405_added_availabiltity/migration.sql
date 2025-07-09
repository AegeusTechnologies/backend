-- CreateTable
CREATE TABLE "Availability" (
    "id" SERIAL NOT NULL,
    "deviceDevEui" TEXT NOT NULL,
    "totalRobot" INTEGER NOT NULL,
    "ActiveRunRobot" INTEGER NOT NULL,
    "ActiveIdleRobot" INTEGER NOT NULL,
    "TotalRunningLength" INTEGER NOT NULL,
    "RobotActivePercentage" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Availability_deviceDevEui_key" ON "Availability"("deviceDevEui");
