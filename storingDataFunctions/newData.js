const { raw } = require("@prisma/client/runtime/library");
const prisma = require("../config/prismaConfig");
require('dotenv').config();

/**
 * Calculates how many panels were cleaned based on the odometer value.
 * @param {number} odometerValue 
 * @returns {number}
 */
function calculatePanelsCleaned(odometerValue) {
    const gap = parseFloat(process.env.PANNELS_GAP);
    const width = parseFloat(process.env.PANNELWIDTH);

    if (isNaN(gap) || isNaN(width)) {
        throw new Error("Invalid environment variables: PANNELS_GAP or PANNELWIDTH");
    }

    return Math.floor(odometerValue / (gap + width));
}

/**
 * Store new device data
 */
async function newData(data, block) {
    try {
        block = block || "Unknown Block";
        const rawOdometer = parseInt(data.object.CH10);
        const result = await prisma.robot_data.create({
            data: {
                device_id: data.deviceInfo.devEui,
                block,
                device_name: data.deviceInfo.deviceName,
                panels_cleaned: parseFloat("0"),
                raw_odometer_value: rawOdometer,
                battery_discharge_cycle: data.object.CH6,
                AutoCount: parseInt(data.object.CH15),
                ManuallCount: parseInt(data.object.CH16),
            }
        });

        return { success: true, message: "Data stored successfully", data: result };
        
    } catch (error) {
        console.error("Error in newData:", {
            message: error.message,
            stack: error.stack,
            data: JSON.stringify(data)
        });
        throw error;
    }
}

/**
 * Handle odometer reset scenario
 */
async function odometerIfReset(data,previousOdomater, block) {
    try {
        const rawOdometer = parseInt(data.object.CH10);
        const dev= Math.abs(rawOdometer - previousOdomater);

        // if(dev<5){
        //     return { success: false, message: "No significant change in odometer after reset, skipping storage" };
        // }

        const result = await newData(data, block);

        return { success: true, message: "Data stored after odometer reset", data: result };
    } catch (error) {
        console.error("Error in odometerIfReset:", {
            message: error.message,
            stack: error.stack
        });
        throw error;
    }
}

/**
 * Handle normal odometer increment scenario
 */
async function odometerIfNotReset(data, previousOdometer, block, previousPanelsCleaned) {
    try {
      
        const rawOdometer = parseInt(data.object.CH10);

        const newOdometerDistance = Math.abs(rawOdometer - previousOdometer);
        const newPanelsCleaned = calculatePanelsCleaned(newOdometerDistance);

        // Step 4: Store new data if there is a change
        const result = await prisma.robot_data.create({
            data: {
                device_id: data.deviceInfo.devEui,
                device_name: data.deviceInfo.deviceName,
                block,
                panels_cleaned: newPanelsCleaned,
                raw_odometer_value: rawOdometer,
                battery_discharge_cycle: data.object.CH6,
                AutoCount: parseInt(data.object.CH15),
                ManuallCount: parseInt(data.object.CH16),
            }
        });

        return { success: true, message: "Data stored successfully", data: result };
    } catch (error) {
        console.error("Error in odometerIfNotReset:", {
            message: error.message,
            stack: error.stack
        });
        throw error;
    }
}


async function ifOdomterIsSame(data,previousOdomater,block,previousPanelsCleaned){
    try {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0); 
        
        const existingData = await prisma.robot_data.findFirst({
            where: {
                device_id: data.deviceInfo.devEui,
                createdAt: {
                    gte: today
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            select: {
                raw_odometer_value: true,
                panels_cleaned: true
            }
        });

         if (existingData?.raw_odometer_value === previousOdomater && existingData?.panels_cleaned === 0) {
           // console.log("No change in odometer or panels cleaned today, skipping storage for device:", data.deviceInfo.deviceName);
            return { success: false, message: "No change in odometer or panels cleaned today, skipping storage" };
        }else{
            const result = await newData(data, block);
            return { success: true, message: "Data stored successfully", data: result };
        }

        
    } catch (error) {
        console.error("Error in ifOdomterIsSame:", error);
        return { success: false, message: "Error occurred", error };
    }
}

module.exports = { newData, odometerIfReset, odometerIfNotReset,ifOdomterIsSame };