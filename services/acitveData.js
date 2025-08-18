const prisma = require("../config/prismaConfig");

async function activelyRunning(data) {
    try {
        const date = new Date();
        const manuallCount = parseInt(data.object.CH16 ?? "0", 10);
        const AutoCount = parseInt(data.object.CH15 ?? "0", 10);

        const result = await prisma.robot_data.findFirst({
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
                AutoCount: true,
                ManuallCount: true,
                block:true
            }
        });
        console.log("Result from robot_data:", result);

        if (!result) {
            console.log("No previous data found for device:",data.deviceInfo.name);
            return;
        }

        const newAutoCount = AutoCount - (result.AutoCount ?? 0);
        const newManualCount = manuallCount - (result.ManuallCount ?? 0);

        let existingRunningData = await prisma.runningData.findFirst({
            where: {
                device_id: data.deviceInfo.devEui,
                createdAt: {
                    gte: new Date(date.getFullYear(), date.getMonth(), date.getDate())
                }
            }
        });

        if (!existingRunningData) {
            console.log("Creating new running data for:", data.deviceInfo.name);

            await prisma.runningData.create({
                data: {
                    device_id: data.deviceInfo.devEui,
                    device_name: data.deviceInfo.deviceName,
                    autoCount: AutoCount,
                    manualCount: manuallCount,
                    block: result.block || "Unknown Block",
                }
            });
        } else {
            await prisma.runningData.update({
                where: {
                    id: existingRunningData.id,
                },
                data: {
                    autoCount: existingRunningData.autoCount + newAutoCount,
                    manualCount: existingRunningData.manualCount + newManualCount,
                    updateAt: new Date()
                }
            });
        }

    } catch (error) {
        console.error("Error in activelyRunning:", {
            message: error.message,
            stack: error.stack
        });
        throw error;
    }
}

module.exports = activelyRunning
