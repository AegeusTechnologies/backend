const Redis = require('ioredis');
const storeDataToDatabase = require('../mqttConnection/prismaData');
const storeStatusData = require('../mqttConnection/statusRobotRedis');
const storeDataToRedis = require('../mqttConnection/redisData');
const redis = new Redis(); // configure as needed

async function converToCh(data) {
    try {
        const reMap = {
            data1: "CH1",
            data11: "CH2",
            data19: "CH10", // odometer
            data3: "CH24",
            data4: "CH5",
            data6: "CH14",
            data7: "CH25",
            data20: "CH11",  // keep it has random rumber
            data8: "CH8",
            data9: "CH26",
            data15: "CH9",  // position
            data22: "CH12",  // keep it has random rumber
            data14: "CH7",  //fault code 
            data28: "CH18", 
            data12: "CH4",
            data16: "CH16",
            data23: "CH17", // discharge
            data18: "CH6", // battery
        };
        const newPayload = {};

        // Convert only the keys inside data.object
        for (const key in data.object) {
            if (reMap.hasOwnProperty(key)) {
                newPayload[reMap[key]] = data.object[key];
            } else {
                newPayload[key] = data.object[key];
            }
        }

        // Replace data.object with the converted payload
        data.object = newPayload;
        await Promise.all([
        storeDataToDatabase(data),
        storeDataToRedis(data),
        storeStatusData(data),
        ]);

        // Store the whole data in Redis (as a string)
     //   await redis.set(`payload:${data.deduplicationId}`, JSON.stringify(data));

        console.log("Converted and stored Payload:", data);
        return data;
    } catch (error) {
        console.error("Error in converToCh:", error.message);
        throw error;
    }
}

async function FormatetoCH(data){
    try {
        const reMap={
            CH1: "CH1",
            CH11: "CH2",// odometer
            CH3: "CH24",
             CH4: "CH5",
            CH6: "CH14",
                        CH7: "CH25",
                        CH20: "CH11",  // keep it has random rumber
                        CH8: "CH8",
                        CH9: "CH26",
                        CH15: "CH9",  // position
                        CH22: "CH12",  // keep it has random rumber
                        CH14: "CH7",  //fault code 
                        CH28: "CH18", 
                        CH12: "CH4",
                        CH16: "CH16",
                        CH23: "CH17", // discharge
                        CH18: "CH6", // battery
        }

         const newPayload = {};

        // Convert only the keys inside data.object
        for (const key in data.object) {
            if (reMap.hasOwnProperty(key)) {
                newPayload[reMap[key]] = data.object[key];
            } else {
                newPayload[key] = data.object[key];
            }
        }

        // Replace data.object with the converted payload
        data.object = newPayload;
        await Promise.all([
        storeDataToDatabase(data),
        storeDataToRedis(data),
        storeStatusData(data),
        ]);

        
    } catch (error) {
        console.error("Error in converToCh:", error.message);
        throw error;
        
    }

}

module.exports = {converToCh, FormatetoCH};
