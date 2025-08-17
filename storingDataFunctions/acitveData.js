const prisma = require("../config/prismaConfig");

async function createNewRunningData(data) {
    try {
        const block = await fetchBlock(String(data.deviceInfo.devEui));
        console.log("Fetched block for only the active dgclisvdkqjvdqhavb:", block);

        const manuallCount = parseInt(data.object.CH16 ?? "0", 10);
        const AutoCount = parseInt(data.object.CH15 ?? "0", 10);

        const result = await prisma.runningData.create({
            data: {
                device_id: data.deviceInfo.devEui,
                device_name: data.deviceInfo.deviceName,
                autoCount: AutoCount,
                manualCount: manuallCount,
                block: String(block ? block.block : "Unknown Block"),
            }
        });

        return { success: true, message: "New running data created successfully", data: result };
    } catch (error) {
        console.error("Error creating new running data:", error.message);
        throw error;
    }
}

async function fetchBlock(devEui) {
    console.log("Fetching block for device:", devEui);
    try {
        const result = await prisma.robot_data.findFirst({
            where: { device_id: devEui },
            select: { block: true },
            orderBy: { createdAt: 'desc' }
        });
        return result;
    } catch (error) {
        console.error("Error fetching block:", error.message);
        throw error;
    }
}

async function updatedRunningData(data, autoCount, manualCount) {
    try {
     // firstu todays latest data thago
        const existing = await prisma.runningData.findFirst({
            where: {
                device_id: data.deviceInfo.devEui,
                createdAt: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0)) // today
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!existing) {
            throw new Error("No existing running data found to update");
        }

        // Update that record
        const updateData = await prisma.runningData.update({
            where: { id: existing.id },
            data: {
                autoCount: autoCount,
                manualCount: manualCount,
                updateAt: new Date()
            }
        });

        console.log("Running data updated successfully for device:", data.deviceInfo.devEui);
        return { success: true, message: "Running data updated successfully", data: updateData };
    } catch (error) {
        console.error("Error updating running data:", error.message);
        throw error;
    }
}

module.exports = {
    createNewRunningData,
    fetchBlock,
    updatedRunningData
};
