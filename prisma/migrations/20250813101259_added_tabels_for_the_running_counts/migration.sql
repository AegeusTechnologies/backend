-- CreateTable
CREATE TABLE "RunningData" (
    "id" SERIAL NOT NULL,
    "device_id" TEXT NOT NULL,
    "device_name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RunningData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunningCount" (
    "id" SERIAL NOT NULL,
    "triggerCount" INTEGER NOT NULL,
    "notTriggerCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RunningCount_pkey" PRIMARY KEY ("id")
);
