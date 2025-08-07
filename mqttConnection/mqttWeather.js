const mqtt = require('mqtt');
const {getWeatherData, storeWeatherData}=require('../services/weatherConfig')



const mqttBrokerURL = process.env.MQTT_URL;
const options = {
    clientId: `mqttjs_${Math.random().toString(16).slice(2, 10)}`,
    clean: true,
    keepalive: 60,    
    reconnectPeriod: 4000,
    connectTimeout: 30000,
    qos: 1,
}

async function setupMQTTClient3() {

   
    const client = mqtt.connect(mqttBrokerURL, options);

    client.on('connect', async () => {
        console.log('Connected to MQTT broker for the weather data');
    });

    client.on('message', (topic, message) => handleMessage(topic, message));
    client.on('error', handleError);
    client.on('reconnect', () => handleReconnect());
    client.on('close', () => handleClose());

    try {
        const topic = `application/${process.env.APPLICATION_ID_FOR_WEATHER}/device/+/event/up`;
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
        console.log("Weather data received from the MQTT broker:", data.object);
        storeWeatherData(data.object)
    
         
    } catch (error) {
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




module.exports = {setupMQTTClient3};