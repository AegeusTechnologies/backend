const prisma = require("../config/prismaConfig")

async function handleNewData(data,block) {
    try {
        const result = await prisma.robotRunLog.create({
            data:{
                device_id: data.deviceInfo.devEui,
                device_name: data.deviceInfo.deviceName,
                block: block,
                Raw_Auto_count: parseInt(data.object.CH15),
                Raw_manual_count: parseInt(data.object.CH16),
                AutoCount:0,
                ManualCount: 0
               
            }
        })

        console.info("✅ New active count data stored for device:", data.deviceInfo.devEui);
        return result
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
        const newRawAuto = parseInt(data.object.CH15);
        const newRawManual = parseInt(data.object.CH16);

        const prevRawAuto = history.Raw_Auto_count;
        const prevRawManual = history.Raw_manual_count;

        // Check for reset condition (device counter restarted)
        const isReset =
            newRawAuto < prevRawAuto || newRawManual < prevRawManual;

        // ✅ If reset happened, store new starting point using handleNewData
        if (isReset) {
            console.warn(`⚠️ Counter reset detected for device ${data.deviceInfo.devEui}. Storing fresh baseline.`);
            return await handleNewData(data, block);
        }

        // ✅ If no changes at all, do nothing
        if (newRawAuto === prevRawAuto && newRawManual === prevRawManual) {
            console.info(`ℹ️ No change in count for device ${data.deviceInfo.devEui}. Skipping.`);
            return null;
        }

        // ✅ If increment happened, store delta
        const autoDelta = newRawAuto - prevRawAuto;
        const manualDelta = newRawManual - prevRawManual;

        const result = await prisma.robotRunLog.create({
            data: {
                device_id: data.deviceInfo.devEui,
                device_name: data.deviceInfo.deviceName,
                block: block,
                Raw_Auto_count: newRawAuto,
                Raw_manual_count: newRawManual,
                AutoCount: autoDelta > 0 ? autoDelta : 0,
                ManualCount: manualDelta > 0 ? manualDelta : 0
            }
        });

        console.info(`✅ Incremental data stored for device ${data.deviceInfo.devEui}. Auto: +${autoDelta}, Manual: +${manualDelta}`);
        return result;

    } catch (error) {
        console.error("❌ Error in handleCountData:", error.message);
        throw error;
    }
}

module.exports={
    handleNewData,
    handleCountData
}