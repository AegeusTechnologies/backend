-- CreateTable
CREATE TABLE "Robot_data" (
    "id" SERIAL NOT NULL,
    "device_id" TEXT NOT NULL,
    "device_name" TEXT NOT NULL,
    "panels_cleaned" DOUBLE PRECISION NOT NULL,
    "raw_odometer_value" INTEGER NOT NULL,
    "battery_discharge_cycle" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Robot_data_pkey" PRIMARY KEY ("id")
);
