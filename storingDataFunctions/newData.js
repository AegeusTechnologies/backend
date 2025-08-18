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
        const rawOdometer = data.object.CH10;
        const panelsCleaned = calculatePanelsCleaned(rawOdometer);

        if (panelsCleaned < 0) {
            return { success: false, message: "Panels cleaned < 10, skipping storage" };
        }

        const result = await prisma.robot_data.create({
            data: {
                device_id: data.deviceInfo.devEui,
                block,
                device_name: data.deviceInfo.deviceName,
                panels_cleaned: panelsCleaned,
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
async function odometerIfReset(data, previousOdometerValue, block) {
    try {
        const rawOdometer = data.object.CH10;
        const totalOdometerValue = rawOdometer + previousOdometerValue;

        const totalPanelsCleaned = calculatePanelsCleaned(totalOdometerValue);
        const prevPanelsCleaned = calculatePanelsCleaned(previousOdometerValue);
        const newPanelsCleaned = totalPanelsCleaned - prevPanelsCleaned;

        if (newPanelsCleaned <= 0) {
            return { success: false, message: "No new panels cleaned after odometer reset, skipping storage" };
        }

        const result = await prisma.robot_data.create({
            data: {
                device_id: data.deviceInfo.devEui,
                block,
                device_name: data.deviceInfo.deviceName,
                panels_cleaned: newPanelsCleaned,
                raw_odometer_value: totalOdometerValue,
                battery_discharge_cycle: data.object.CH6,
                AutoCount: parseInt(data.object.CH15),
                ManuallCount: parseInt(data.object.CH16),
            }
        });

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
async function odometerIfNotReset(data, previousOdometer, block) {
    try {
        block = block;
        const rawOdometer = data.object.CH10;
        const newOdometerDistance = rawOdometer - previousOdometer;

        const newPanelsCleaned = calculatePanelsCleaned(newOdometerDistance);

        if (newPanelsCleaned < 0) {
            return { success: false, message: "No new panels cleaned since last update" };
        }

        const result = await prisma.robot_data.create({
            data: {
                device_id: data.deviceInfo.devEui,
                device_name: data.deviceInfo.deviceName,
                block,
                panels_cleaned: newPanelsCleaned,
                raw_odometer_value: rawOdometer,
                battery_discharge_cycle: data.object.CH6,
                AutoCount: parseInt(data.object.CH15),
                ManuallCount:parseInt(data.object.CH16),
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

module.exports = { newData, odometerIfReset, odometerIfNotReset };
