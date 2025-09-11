const mqtt = require('mqtt');
const apiClient = require('../config/apiClient');
const { resendDownlink } = require('../services/resendDownlink');
const { status } = require('./statusRobotRedis');
require('dotenv').config();

let retryCounter = {};
let pendingDownlinks = {};
let delayedResendTimers = {}; 
let retryCounterForAckTrue = {};

const MAX_RETRIES = 2;
const MAX_RETRIES_FOR_ACK_TRUE = 1;
const MESSAGE_HISTORY_SIZE = 200;
const RESEND_DELAY = 30000; // 30 seconds delay
const RESEND_DELAY_FOR_ACK_TRUE = 5000; // 5 seconds delay

const applicationId = process.env.APPLICATION_ID;
const mqttBroker = process.env.MQTT_URL;

const topics = [
    `application/${applicationId}/device/+/event/txack`,
    `application/${applicationId}/device/+/event/ack`
];

let messageHistory = [];

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
            } else {
                console.log('Successfully subscribed to txack & ack events');
            }
        });
    });

    client.on('message', async (topic, message) => {
        try {
            const parts = topic.split('/');
            const deviceEUI = parts[3];
            const eventType = parts[5];
            const event = JSON.parse(message.toString());

            let eventData = {
                timestamp: event.time,
                robotName: event.deviceInfo.deviceName,
                deviceEUI: event.deviceInfo.devEui
            };

            eventData.gatewayReceived = event.queueItemId;

            if (eventType === 'txack') {
                await handleTxAckEvent(deviceEUI, event, eventData);
            } else if (eventType === 'ack') {
                await handleAckEvent(deviceEUI, event, eventData);
            } else {
                console.warn('Unknown event type:', eventType);
            }

            messageHistory.push(eventData);
            if (messageHistory.length > MESSAGE_HISTORY_SIZE) {
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
        console.log('MQTT client disconnected');
    });

    process.on('SIGINT', () => {
        Object.values(delayedResendTimers).forEach(timer => clearTimeout(timer));
        client.end();
        process.exit();
    });

    setInterval(cleanUpExpiredDownlinks, 60 * 1000); // Run every 1 minute
}

async function handleTxAckEvent(deviceEUI, event, eventData) {
    try {
        const response = await apiClient.get(`/api/devices/${deviceEUI}/queue`);
        const { result } = response.data;

        if (result && result.length > 0) {
            const lastDownlink = result[result.length - 1];
            const decoded = Buffer.from(lastDownlink.data, 'base64').toString('hex');

            pendingDownlinks[deviceEUI] = {
                data: lastDownlink.data,
                fPort: lastDownlink.fPort,
                robotName: event.deviceInfo.deviceName || deviceEUI,
                timestamp: Date.now(),
            };

            console.log(`TXACK: Cached latest downlink for ${deviceEUI}:`, decoded);
        } else {
            console.warn(`No downlinks found in queue for ${deviceEUI}`);
        }
    } catch (err) {
        console.error(`Failed to fetch downlinks for ${deviceEUI}:`, err.message);
    }
}

async function handleAckEvent(deviceEUI, event, eventData) {
    const acknowledged = event.acknowledged;
    eventData.acknowledged = acknowledged;

    if (!acknowledged) {
        retryCounter[deviceEUI] = retryCounter[deviceEUI] || 0;

        if (retryCounter[deviceEUI] < MAX_RETRIES) {
            const cached = pendingDownlinks[deviceEUI];
            if (cached) {
                retryCounter[deviceEUI]++;
                console.warn(`ACK failed. Will retry (${retryCounter[deviceEUI]}/${MAX_RETRIES}) for ${deviceEUI} after ${RESEND_DELAY / 1000} seconds`);

                scheduleDelayedResend(deviceEUI, cached, RESEND_DELAY);
            } else {
                console.warn(`No cached downlink to retry for ${deviceEUI}`);
            }
        } else {
            console.warn(`Max retries reached for ${deviceEUI}. No more downlink attempts.`);
            clearResendTimer(deviceEUI);
        }
    } else {
        console.log(`ACK successful for ${deviceEUI}. Clearing cache and timers.`);
        clearPendingData(deviceEUI);
    }

    console.log(`ACK event for device ${deviceEUI}:`, eventData);
}

async function scheduleDelayedResend(deviceEUI, cached, delay) {
    if (delayedResendTimers[deviceEUI]) {
        clearTimeout(delayedResendTimers[deviceEUI]);
    }

    delayedResendTimers[deviceEUI] = setTimeout(async () => {
        try {
            let key = `status:${deviceEUI}`;
            const isRunning = status.get(key);
            
            if (isRunning == "STOPPED") {
                console.log(`Executing delayed resend for ${deviceEUI}`);
                await resendDownlink(deviceEUI, cached.robotName, cached.data, cached.fPort);
            } else {
                console.log(`Device ${deviceEUI} is RUNNING. Skipping delayed downlink resend.`);
            }
        } catch (error) {
            console.error(`Error in delayed resend for ${deviceEUI}:`, error.message);
        } finally {
            clearResendTimer(deviceEUI);
        }
    }, delay);
}

function clearResendTimer(deviceEUI) {
    if (delayedResendTimers[deviceEUI]) {
        clearTimeout(delayedResendTimers[deviceEUI]);
        delete delayedResendTimers[deviceEUI];
    }
}

function clearPendingData(deviceEUI) {
    delete pendingDownlinks[deviceEUI];
    delete retryCounter[deviceEUI];

    clearResendTimer(deviceEUI);
}

function cleanUpExpiredDownlinks() {
    const now = Date.now();
    const EXPIRY_TIME = 10 * 60 * 1000; // 10 minutes

    for (const devEui in pendingDownlinks) {
        if (now - pendingDownlinks[devEui].timestamp > EXPIRY_TIME) {
            console.log(`Cleaning up expired downlink for ${devEui}`);
            delete pendingDownlinks[devEui];
            clearResendTimer(devEui);
        }
    }
}

async function getAllMessage() {
    return [...messageHistory].reverse();
}

async function getMessageCount() {
    return messageHistory.length;
}

async function clearMessageHistory() {
    messageHistory = [];
    retryCounter = {};
    pendingDownlinks = {};
    delayedResendTimers = {};
}

async function getPendingResends() {
    return Object.keys(delayedResendTimers).map(deviceEUI => ({
        deviceEUI,
        robotName: pendingDownlinks[deviceEUI]?.robotName || 'Unknown',
        retryAttempt: retryCounter[deviceEUI] || 0
    }));
}

module.exports = {
    mqttEvents,
    getAllMessage,
    getMessageCount,
    clearMessageHistory,
    getPendingResends
};
