const prisma = require("../config/prismaConfig");
const { newData, odometerIfNotReset, odometerIfReset } = require("../storingDataFunctions/newData");
require('dotenv').config(); 
const axios = require('axios');

const apiClient = axios.create({
    baseURL: process.env.API_URL,  // Make sure this is defined in your .env
    timeout: 5000,
    headers: {
        'Grpc-Metadata-Authorization': `Bearer ${process.env.API_TOKEN}`,
        'accept': 'application/json',
    }
});

async function storeDataToDatabase(data) {
    try {
        // Validate incoming data
        if (!data?.object?.CH1 || !data?.deviceInfo?.devEui) {
            console.info("Invalid data structure", data?.object?.CH1, data?.deviceInfo?.devEui);
            return false;
        }
        
        // Skip zero odometer readings
        if (data.object.CH10 === 0) {
            console.info("Skipping record with zero odometer value");
            return false;
        }

        // Fetch device block info from API
        let blockDescription = "Unknown Block";
        try {
            const block = await apiClient.get(`/api/devices/${data.deviceInfo.devEui}`);
           // blockDescription = block?.data?.device?.description ?? "Unknown Block";
            blockDescription = String(block?.data?.device?.description ?? "Unknown Block");

           // console.log("Block data fetched successfully:", blockDescription);
        } catch (error) {
            console.error("Error fetching device block data:", error.message);
            throw new Error(`Error fetching device block data: ${error.message}`);
        }

        // Fetch latest history from database
        const historyData = await prisma.robot_data.findFirst({
            where: { device_id: data.deviceInfo.devEui },
            orderBy: { createdAt: 'desc' },
            select: {
                panels_cleaned: true,
                raw_odometer_value: true,
            }
        });

        // console.log("=== HISTORY DATA ===");
        // console.log("Previous record from DB:", historyData);
        // console.log("Current incoming odometer:", data.object.CH10);
        // console.log("====================");

        // No previous record — treat as new data
        if (!historyData) {
            console.info("New device data is being stored");
            return await newData(data, blockDescription);
        }

        const currentOdometer = parseInt(data.object.CH10);

        // Odometer reset
        if (currentOdometer < historyData.raw_odometer_value) {
            console.info("Odometer has been reset");
            return await odometerIfReset(
                data,
                historyData.raw_odometer_value,
                historyData.panels_cleaned,
                blockDescription
            );
        }

        // Odometer advanced
        if (currentOdometer > historyData.raw_odometer_value) {
            console.info("Odometer has advanced");
            return await odometerIfNotReset(
                data,
                historyData.raw_odometer_value,
                blockDescription
            );
        }

        // No significant change
        return {
            success: false,
            message: "Duplicate data - no significant odometer change",
            skipped: true
        };

    } catch (error) {
        console.error("Error in storing data to database:", {
            message: error.message,
            stack: error.stack,
            data: JSON.stringify(data, null, 2)
        });
        throw error;
    }
}

module.exports = storeDataToDatabase;
