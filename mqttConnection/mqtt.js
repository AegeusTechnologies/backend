const mqtt = require('mqtt');
const storeDataToDatabase = require('./prismaData');
const storeDataToRedis = require('./redisData');
const { storeStatusData } = require('./statusRobotRedis.js');
require('dotenv').config(); 
const axios = require('axios');
const activelyRunning = require('../services/acitveData.js');
//const { getRobotCount } = require('../services/ActiveRunRobot.js');

const mqttBrokerURL = process.env.MQTT_URL;
const options = {
    clientId: `mqttjs_${Math.random().toString(16).slice(2, 10)}`,
    clean: true,
    keepalive: 60,    
    reconnectPeriod: 4000,
    connectTimeout: 30000,
    qos: 1,
}

async function setupMQTTClient2() {
    const client = mqtt.connect(mqttBrokerURL, options);

    client.on('connect', async () => {
        console.log('Connected to MQTT broker');
    });

    client.on('message', (topic, message) => handleMessage(topic, message));
    client.on('error', handleError);
    client.on('reconnect', () => handleReconnect());
    client.on('close', () => handleClose());

    try {
        const topic = `application/${process.env.APPLICATION_ID}/device/+/event/up`;
        client.subscribe(topic, async (error) => {
            if (error) {
                console.log("Error on subscribing to the topic:", error);
                throw error;
            }
        });
        
    } catch (error) {
        console.log("Error on subscribing to the topic");
        console.log(error);
    }

    return client;
}

async function handleMessage(_topic, message) {
    try {
        const data = JSON.parse(message.toString());
       //console.log("Message received from the MQTT broker:", data);
        await storeDataToRedis(data); // first store the data in redis
        await storeStatusData(data);   // first update the status in map
        await storeDataToDatabase(data); // store the data in the database
        await activelyRunning(data); // update the actively running robots
       
     
        // const timestamp = Date.now();
        // const random10Digit = Math.floor(Math.random() * 9000000000) + 1000000000;
        // const uniqueId = `${timestamp}${random10Digit}`.slice(0, 10);
        
        // const payload = {
        //     "data_id": `AEG5${uniqueId}`,
        //     "robot_id": `AEG5${data.object.CH1}`,
        //     "robot_status": data.object.CH2 ? "RUNNING" : "STOPPED",
        //     "battery_percent": data.object.CH4,
        //     "fault_code": data.object.CH7, 
        //     "total_running_length": data.object.CH10,
        //     "total_panels_cleaned": 2 * data.object.CH10 * (Number(process.env.MULTIPLICATION_FACTOR) - Number(process.env.PANNELS_GAP)),
        // }

      //  console.log("Payload to be sent to AWS:", payload);

//         try {
//             const response = await axios.post(process.env.AWS_ENDPOINT_URL, payload, {
//                 headers: {
//                     'Content-Type': 'application/json'
//                 },
//                 timeout: 5000 
//             });
            
//             console.log("Data sent to AWS successfully:", response.data);
//             return data;
//         } catch (axiosError) {
//             console.error("AWS API Error:", {
//                 status: axiosError.response?.status,
//                 message: axiosError.message,
//                 url: process.env.AWS_ENDPOINT_URL,
//                 data: axiosError.response?.data
//             });
            
//             // You might want to store failed requests for retry
//             throw new Error(`AWS API Error: ${axiosError.message}`);
//         }
    } catch (error) {
        console.error("Message handling error:", error);
        throw error;
    }
}

async function handleError(error) {
    console.log("Error on subscribing to the topic:", error);
}

async function handleReconnect() {
    console.log("Reconnecting to the MQTT broker");
}

async function handleClose() {
    console.log("Closing the connection to the MQTT broker");
}

module.exports = {setupMQTTClient2};