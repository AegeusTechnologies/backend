const mqtt = require('mqtt');
const storeDataToDatabase = require('./prismaData');
const storeDataToRedis = require('./redisData');
const { storeStatusData } = require('./statusRobotRedis.js');
const activelyRunning = require('../services/acitveData.js');
const axios = require('axios');
const moment = require('moment');
require('dotenv').config();

const mqttBrokerURL = process.env.MQTT_URL;

const options = {
    clientId: `mqttjs_${Math.random().toString(16).slice(2, 10)}`,
    clean: true,
    keepalive: 60,
    reconnectPeriod: 4000,
    connectTimeout: 30000,
    qos: 1,
};

async function setupMQTTClient2() {
    const client = mqtt.connect(mqttBrokerURL, options);

    client.on('connect', () => {
        console.log('✅ Connected to MQTT broker');
    });

    client.on('message', (topic, message) => handleMessage(topic, message));
    client.on('error', handleError);
    client.on('reconnect', handleReconnect);
    client.on('close', handleClose);

    try {
        const topic = `application/${process.env.APPLICATION_ID}/device/+/event/up`;
        client.subscribe(topic, (error) => {
            if (error) {
                console.error("❌ Error subscribing to topic:", error);
                throw error;
            }
            console.log(`✅ Subscribed to topic: ${topic}`);
        });
    } catch (error) {
        console.error("❌ Error in MQTT subscription:", error);
    }

    return client;
}

async function handleMessage(_topic, message) {
    try {
        const data = JSON.parse(message.toString());
        // console.log("Message received from the MQTT broker:", data);

        if(data.object.CH1== 0 || data.object.CH1== undefined || data.object.CH1== null || data.object.CH1== "0"){
            console.info("Skipping processing due to CH1 being 0 or undefined for device:", data.deviceInfo.deviceName);
            return;
        }

        try {
            await storeDataToRedis(data);
        } catch (e) {
            console.error("❌ Failed to store data to Redis:", e);
        }
        
        try {
            await storeStatusData(data);
        } catch (e) {
            console.error("❌ Failed to store status data:", e);
        }
        
        try {
            await storeDataToDatabase(data);
        } catch (e) {
            console.error("❌ Failed to store data to database:", e);
        }
        
        try {
            await activelyRunning(data);
        } catch (e) {
            console.error("❌ Failed to update active data:", e);
        }
        

        const timestamp = Date.now();
        const random10Digit = Math.floor(Math.random() * 9000000000) + 1000000000;
        const uniqueId = `AEG${(timestamp + random10Digit).toString().slice(0, 12)}`;

        const formattedTimestamp = moment().format('YYYY-MM-DD HH:mm:ss');

        const {
            CH1, // Robot ID
            CH2, // Status
            CH4, // Battery %
            CH7, // Fault Code
            CH9, // Running length
            CH10, // Total running length
            CH11, // Signal Strength
            CH12, // GPS
            CH13, // RFID
            CH14, // TempA
            CH15, // Temp1
            CH16, // Temp2
            CH17, // Temp3
            CH18  // Temp4
        } = data?.object || {};

        const payload = {
            data: {
                Data_ID: uniqueId,
                Timestamp: formattedTimestamp,
                Robot_ID: `AEGU${CH1 || 'UNKNOWN'}`,
                Robot_Status: CH2 ? "Operational" : "Stopped",
                Running_length: String(CH9 || "0"),
                Total_running_length: CH10?.toString() || "0",
                Signal_Strength: data.rxInfo?.[0]?.rssi?.toString() || "0",
                Battery_percent: CH4?.toString() || "0",
                GPS: CH12 ? CH12.toString() : "0,0",
                RFID: CH13?.toString() || "-1",
                TempA: CH14?.toString() || "0.0",
                Temp1: CH15?.toString() || "0.0",
                Temp2: CH16?.toString() || "0.0",
                Temp3: CH17?.toString() || "0.0",
                Temp4: CH18?.toString() || "0.0"
            }
        };

     //   console.log("📤 Payload to be sent to AEGEUS API:", payload);

        try {
            const response = await axios.post(
                "https://aegeusapp.devspal.com/api/data",
                payload,
                {
                    headers: {
                        'apikey': '2a345678-f91g-920w-45e8e-936ce-l71jq',
                        'Content-Type': 'application/json'
                    },
                    timeout: 5000
                }
            );

           // console.log("✅ Data sent to AEGEUS API successfully:", response.data);
            return data;
        } catch (axiosError) {
            console.error("❌ AEGEUS API Error:", {
                status: axiosError.response?.status,
                message: axiosError.message,
                url: "https://aegeusapp.devspal.com/api/data",
                data: axiosError.response?.data
            });

            throw new Error(`AEGEUS API Error: ${axiosError.message}`);
        }

    } catch (error) {
        console.error("❌ Message handling error:", error);
    }
}

function handleError(error) {
    console.error("❌ MQTT Client Error:", error);
}

function handleReconnect() {
    console.log("🔁 Reconnecting to MQTT broker...");
}

function handleClose() {
    console.log("🔌 MQTT connection closed.");
}

module.exports = { setupMQTTClient2 };
