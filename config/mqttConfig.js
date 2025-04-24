// MQTT connection options configuration
const mqttOptions = {
    clientId: `mqttjs_${Math.random().toString(16).slice(2, 10)}`,
    clean: true,
    keepalive: 60,
    reconnectPeriod: 4000,
    connectTimeout: 30000,
    qos: 1,
};

module.exports = mqttOptions;