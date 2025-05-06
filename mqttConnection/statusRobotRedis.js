
const redisClient = require("../config/redisConfig");

async function storeStatusData(data){

    const statusKey= `status:${data.deviceInfo.devEui}`;
    const statusValue = data.object.CH2 ? "RUNNING" : "STOPPED";
    try {
        await redisClient.set(statusKey, statusValue);
        console.log(`Status data stored in Redis for key: ${statusKey}, value: ${statusValue}`);
    } catch (error) {
        console.error(`Error storing status data in Redis for key: ${statusKey}`, error);
    }
}

module.exports = storeStatusData; //  this has to be exported to be used in mqtt.js