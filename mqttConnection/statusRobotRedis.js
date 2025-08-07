const status = new Map();

async function storeStatusData(data) {
    const statusKey = `status:${data.deviceInfo.devEui}`;
    const statusValue = data.object.CH2 ? "RUNNING" : "STOPPED";

    try {
        status.set(statusKey, statusValue);
        //console.log(`Status data stored in Map for key: ${statusKey}, value: ${statusValue}`);
    } catch (error) {
       // console.error(`Error storing status data in Map for key: ${statusKey}`, error); 
       throw new Error(`Error storing status data in Map: ${error.message}`);
    }
}

module.exports = {
    storeStatusData,
    status 
};
