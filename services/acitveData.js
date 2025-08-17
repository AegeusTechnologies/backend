const prisma = require("../config/prismaConfig");
const { createNewRunningData, updatedRunningData } = require("../storingDataFunctions/acitveData");

async function activelyRunning(data) {
    try {
        const date = new Date();
        const manuallCount = parseInt(data.object.CH16 ?? "0", 10);
        const AutoCount = parseInt(data.object.CH15 ?? "0", 10);

        const result = await prisma.runningData.findFirst({
            where: {
                device_id: data.deviceInfo.devEui,
                createdAt: {
                    gte: new Date(date.getFullYear(), date.getMonth(), date.getDate())
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            select: {
                autoCount: true,
                manualCount: true,
            }
        });

        if (!result) {
            console.log("No previous data found for device:", data.deviceInfo.name);
            await createNewRunningData(data);
            return { success: true, message: "New running data created successfully" };
        }


        const newAutoCount = Math.max(0, AutoCount - result.autoCount);
        const newManualCount = Math.max(0, manuallCount - result.manualCount);

        if (newAutoCount < 0 && newManualCount < 0) {
            console.log("No new counts to update for device:", data.deviceInfo.name);
            return { success: false, message: "No new counts to update" };
        }

        console.log(`Device ${String(data.deviceInfo.name)}: AutoCount +${newAutoCount}, ManualCount +${newManualCount}`);

        const runningData = await updatedRunningData(data, newAutoCount, newManualCount);
        return { success: true, message: "Running data updated successfully", data: runningData };

    } catch (error) {
        console.error("Error in activelyRunning:", {
            message: error.message,
            stack: error.stack
        });
        throw error;
    }
}

module.exports = {
    activelyRunning,
    createNewRunningData,
    updatedRunningData,
};
