const prisma = require("../config/prismaConfig");

async function handleNewData(data, block) {
    try {
        const result = await prisma.robotRunLog.create({
            data: {
                device_id: data.deviceInfo.devEui,
                device_name: data.deviceInfo.deviceName,
                block: block,
                Raw_Auto_count: parseInt(data.object.CH15),
                Raw_manual_count: parseInt(data.object.CH16),
                AutoCount: 0,
                ManualCount: 0
            }
        });
        console.info("✅ New active count data stored for device:", data.deviceInfo.devEui);
        return result;
    } catch (error) {
        console.error("❌ Error storing new active count data:", {
            message: error.message,
            stack: error.stack
        });
        throw error;
    }
}

async function handleCountData(data, block, history) {
    try {
        const newRawAuto = parseInt(data.object.CH15 ?? "0", 10);
        const newRawManual = parseInt(data.object.CH16 ?? "0", 10);
        const prevRawAuto = history.Raw_Auto_count;
        const prevRawManual = history.Raw_manual_count;
        
        const isReset = newRawAuto < prevRawAuto || newRawManual < prevRawManual;
        
        if (isReset) {
            console.warn(`⚠️ Counter reset detected for device ${data.deviceInfo.devEui}. Resetting baseline.`);
            return await handleNewData(data, block);
        }
        
        if (newRawAuto === prevRawAuto && newRawManual === prevRawManual) {
            //console.info(`ℹ️ No change in count for device ${data.deviceInfo.devEui}. Skipping.`);
            return null;
        }
        
        const autoDelta = Math.abs(newRawAuto - prevRawAuto);
        const manualDelta = Math.abs(newRawManual - prevRawManual);
        
        // ✅ CREATE A NEW ROW instead of updating existing one
        const result = await prisma.robotRunLog.create({
            data: {
                device_id: data.deviceInfo.devEui,
                device_name: data.deviceInfo.deviceName,
                block: block,
                Raw_Auto_count: newRawAuto,  // Current raw reading
                Raw_manual_count: newRawManual,  // Current raw reading
                AutoCount: autoDelta,
                ManualCount: manualDelta
            }
        });
        
        console.info(`✅ New row created for device ${data.deviceInfo.devEui}. Auto: +${autoDelta}, Manual: +${manualDelta}`);
        return result;
        
    } catch (error) {
        console.error("❌ Error in handleCountData:", error.message);
        throw error;
    }
}

module.exports = {
    handleNewData,
    handleCountData
};