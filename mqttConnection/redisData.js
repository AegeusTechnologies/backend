const redisClient = require("../config/redisConfig");
const { getAllErrorData } = require("../services/errorData");
const { robotBattery } = require("../services/robotBattery");
require('dotenv').config(); 



async function storeDataToRedis(data){

    //console.log("Data is being stored to Redis for key: ", data.deviceInfo.devEui);
    try {
        const key = data.deviceInfo.devEui;
        const value = JSON.stringify(data);
        await redisClient.set(key, value);
        await getAllErrorData(data.deviceInfo.devEui,data.deviceInfo.deviceName,data.object.CH7)
        await robotBattery(data.deviceInfo.devEui,data.object.CH5);
 
    
    } catch (error) {
        //console.error(`Error in storing data to Redis for key: ${data.deviceInfo.devEui} with data: ${JSON.stringify(data)}`, error);
        throw new Error(`Error in storing data to Redis: ${error.message}`);
    }  

}

module.exports = storeDataToRedis; //  this has to be exported to be used in mqtt.js