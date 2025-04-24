const mqtt = require('mqtt');

const applicationId = process.env.APPLICATION_ID;
const mqttBroker = process.env.MQTT_BROKER_URL || 'mqtt://103.161.75.85:1885'; // Default value
const topics = [
    `application/${applicationId}/device/+/event/txack`,
    `application/${applicationId}/device/+/event/ack`
];

let messageHistory = [];
const messageHistorySize = 100;

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
            // Add a clientId to prevent conflicts
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

    client.on('message', (topic, message) => {
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
    return (messageHistory);
}

async function getMessageCount() {
    return( messageHistory.length)
}

async function clearMessageHistory() {
    messageHistory = [];
}

module.exports = {
    mqttEvents,
    getAllMessage,
    getMessageCount,
    clearMessageHistory
};