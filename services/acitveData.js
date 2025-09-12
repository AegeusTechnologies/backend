const prisma = require("../config/prismaConfig");
const { handleNewData, handleCountData } = require("../storingDataFunctions/automanual");

async function activelyRunning(data) {

    if(data.object.CH1== 0 || data.object.CH1== undefined){
        console.info("Skipping active count processing due to CH1 being 0 or undefined for device:", data.deviceInfo.deviceName);
        return;
    }

    if(data.object.CH15 == 0 && data.object.CH16 == 0){
        console.info("Skipping active count processing due to both CH15 and CH16 being 0 for device:", data.deviceInfo.deviceName);
        return;
    }
    try {
        const history = await prisma.robotRunLog.findFirst({
            where: { device_id: data.deviceInfo.devEui },
            orderBy: { createdAt: 'desc' },
            select: {
                id:true,
                AutoCount: true,
                Raw_Auto_count: true,
                ManualCount: true,
                Raw_manual_count: true,
                createdAt: true
            }
        });

        
        let blockName = "Unknown Block";

        try {
            const block = await prisma.robot_data.findFirst({
                where: {
                    device_id: data.deviceInfo.devEui
                },
                orderBy: {
                    createdAt: 'desc'
                },
                select: {
                    block: true
                }
            });

            if (block?.block) {
                blockName = block.block;
            }
        } catch (error) {
            console.error("Error fetching block data for active count:", error.message);
        }

        if (!history) {
            console.info("No previous active count data found for device:", data.deviceInfo.deviceName);
            await handleNewData(data, blockName);
            return;
        } else {
            await handleCountData(data, blockName, history);
        }

    } catch (error) {
        console.error("❌ Error in activelyRunning:", error.message);
    }
}


module.exports = activelyRunning
