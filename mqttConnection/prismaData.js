const prisma = require("../config/prismaConfig");
const { newData, odometerIfNotReset, odometerIfReset } = require("../storingDataFunctions/newData");
require('dotenv').config(); 
const axios = require('axios');

const apiClient = axios.create({
    baseURL: process.env.API_URL,
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
            console.info("Invalid data structure - missing required fields");
            return { success: false, message: "Invalid data structure" };
        }
        
        const currentOdometer = parseInt(data.object.CH10);
        
        // Validate odometer value
        if (isNaN(currentOdometer) || currentOdometer < 0) {
            console.info("Invalid odometer value:", data.object.CH10);
            return { success: false, message: "Invalid odometer value" };
        }

        // Fetch device block info from API
        let blockDescription = "";
        try {
            const block = await apiClient.get(`/api/devices/${data.deviceInfo.devEui}`);
            blockDescription = String(block?.data?.device?.description ?? "Unknown Block");
            console.log(`Fetched block description from ${block?.data?.device?.name}:`, blockDescription);
        } catch (error) {
            console.error("Error fetching device block data:", error.message);
            // Consider if you want to throw here or continue with "Unknown Block"
            blockDescription = "Unknown Block";
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

        // No previous record — treat as new data
        if (!historyData) {
            console.info("New device data is being stored");
            return await newData(data, blockDescription);
        }

        const previousOdometer = historyData.raw_odometer_value;

        // Compare odometer values and handle accordingly
        if (currentOdometer < previousOdometer) {
            console.info("Odometer has been reset");
            return await odometerIfReset(
                data,
                previousOdometer,
                historyData.panels_cleaned,
                blockDescription
            );
        } else if (currentOdometer > previousOdometer) {
            console.info("Odometer has advanced");
            return await odometerIfNotReset(
                data,
                previousOdometer,
                blockDescription
            );
        } else {
            // currentOdometer === previousOdometer
            console.info("No odometer change - duplicate data");
            return {
                success: false,
                message: "Duplicate data - no odometer change",
                skipped: true
            };
        }

    } catch (error) {
        console.error("Error in storing data to database:", {
            message: error.message,
            stack: error.stack,
            deviceId: data?.deviceInfo?.devEui,
            timestamp: new Date().toISOString()
        });
        
        return { 
            success: false, 
            message: `Database storage failed: ${error.message}` 
        };
    }
}

module.exports = storeDataToDatabase;