const mqtt = require('mqtt');
const { resendDownlink } = require('../services/resendDownlink');
const apiClient = require('../config/apiClient');
require('dotenv').config(); 

let retryCounter = {};
const MAX_RETRIES = 2;

const applicationId = process.env.APPLICATION_ID;
const mqttBroker = process.env.MQTT_URL 
const topics = [
   // `application/${applicationId}/device/+/event/txack`,
    `application/${applicationId}/device/+/event/ack`
];

let messageHistory = [];
const messageHistorySize = 200;

async function mqttEvents() {
    if (!applicationId) {
        console.error('APPLICATION_ID environment variable not set.');
        return;
    }

    const config = {
        broker: mqttBroker,
        topics: topics,
        clientOptions: {
            keepalive: 60,
            reconnectPeriod: 1000,
            clean: true,
            clientId: `mqtt_${Math.random().toString(16).slice(2, 10)}`
        }
    };

    const client = mqtt.connect(config.broker, config.clientOptions);

    client.on('connect', () => {
        console.log('Connected to MQTT broker');
        client.subscribe(config.topics, (err) => {
            if (err) {
                console.error('Subscription error:', err);
                return;
            }
            console.log('Successfully subscribed to txack & ack events');
        });
    });

    client.on('message', async (topic, message) => {

        console.log(`Received message on topic ${topic}:`, message.toString());
        try {
            const eventType = topic.split('/')[5];
            const deviceEUI = topic.split('/')[3];
            const event = JSON.parse(message.toString());

            let eventData = {
                timestamp: event.time,
                robotName: event.deviceInfo.deviceName,
                deviceEUI: event.deviceInfo.devEui
            };

        if (eventType === 'txack') {
            eventData.Gatewayreceived = event.queueItemId;
            console.log(`TXACK event for device ${deviceEUI}:`, eventData);
        } else if (eventType === 'ack') {
            eventData.acknowledged = event.acknowledged;

            if (!eventData.acknowledged) {
                retryCounter[deviceEUI] = retryCounter[deviceEUI] || 0;

                if (retryCounter[deviceEUI] < MAX_RETRIES) {
                    retryCounter[deviceEUI]++;
                    console.warn(`ACK not received. Retrying (${retryCounter[deviceEUI]}/${MAX_RETRIES}) for device ${deviceEUI}`);

                try {
                    const { data } = await apiClient.get(`devices/${deviceEUI}/queue`);
                    
                    if (data.result && data.result.length > 0) {
                        const latestItem = data.result[data.result.length - 1];  // last item
                        const decoded = Buffer.from(latestItem.data, "base64").toString("hex");

                        console.log("Latest downlink:", latestItem);
                        console.log("Decoded payload (hex):", decoded);

                        await resendDownlink(latestItem.devEui, eventData.robotName, latestItem);
                    } else {
                        console.error(`No downlink queue item found for device ${deviceEUI}`);
                    }
                } catch (err) {
                    console.error(`Failed to fetch queue for device ${deviceEUI}:`, err.message);
                }
            } else {
                console.warn(`Max retries reached for device ${deviceEUI}. No more downlink attempts.`);
            }
        } else {
            if (retryCounter[deviceEUI]) {
                console.log(`ACK received for device ${deviceEUI}, resetting retry counter.`);
                delete retryCounter[deviceEUI];
            }
        }

        console.log(`ACK event for device ${deviceEUI}:`, eventData);
    } else {
        console.warn('Unknown event type:', eventType);
        return;
    }

    messageHistory.push(eventData);
    if (messageHistory.length > messageHistorySize) {
        messageHistory.shift();
    }

    } catch (error) {
        console.error('Message processing error:', error);
    }
});

    client.on('error', (err) => {
        console.error('MQTT Error:', err);
    });

    client.on('close', () => {
        console.log('Client disconnected');
    });

    process.on('SIGINT', () => {
        client.end();
        process.exit();
    });
}

async function getAllMessage() {
    return [...messageHistory].reverse();
}

async function getMessageCount() {
    return( messageHistory.length)
}

async function clearMessageHistory() {
    messageHistory = [];
    retryCounter = {};
}


module.exports = {
    mqttEvents,
    getAllMessage,
    getMessageCount,
    clearMessageHistory
};