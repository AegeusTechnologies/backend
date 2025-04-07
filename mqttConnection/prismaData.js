const prisma = require("../config/prismaConfig");
const { newData, odometerIfNotReset, odometerIfReset } = require("../storingDataFunctions/newData");


async function storeDataToDatabase(data) {
    try {
        // Skip invalid data
        if (!data?.object?.CH1 || !data?.deviceInfo?.devEui) {
            console.info("Invalid data structure");
            return false;
        }

        // Skip zero odometer readings
        if (data.object.CH10 === 0) {
            console.info("Skipping record with zero odometer value");
            return false;
        }

            // Find most recent data for this device
            const historyData = await prisma.robot_data.findFirst({
                where: {
                    device_id: data.deviceInfo.devEui
                },
                orderBy: {
                    createdAt: 'desc' 
                },
                select: {
                    panels_cleaned: true,
                    raw_odometer_value: true,
                }
            });
        // Handle first data point for this device
        if (!historyData) {
            console.info("New device data is being stored");
            await newData(data);
            return true;
        } 
        // Check if odometer was reset (current value is significantly less than previous)
        if (parseInt(data.object.CH10) < historyData.raw_odometer_value) {  // FIXED: using parseInt instead of parseFloat
            console.info("Odometer has been reset");
            const result = await odometerIfReset(data, historyData.raw_odometer_value, historyData.panels_cleaned);  // FIXED: passing historyData.raw_odometer_value
            return result;
        }

        
        // Check if odometer has advanced (with a small threshold to avoid duplicate entries that is 0.01)
        if (parseInt(data.object.CH10) > historyData.raw_odometer_value) {  // FIXED: using parseInt instead of parseFloat
            console.info("Odometer has advanced");
            const result = await odometerIfNotReset(data, historyData.panels_cleaned);
            return result;
        }

        return {
            success: false,
            message: "Duplicate data - no significant odometer change",
            skipped: true
        };
        
    } catch (error) {
        console.error("Error in storing data to database:", {
            message: error.message,
            stack: error.stack,
            data: JSON.stringify(data)
        });
        throw error; // Propagate error to caller
    }
}
module.exports = storeDataToDatabase; //  this has to be exported to be used in mqtt.js 