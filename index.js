
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mqtt = require('mqtt'); 
const { Pool } = require('pg');
const reportRoutes = require('./routes/reportRoutes');
const cron = require('node-cron');  
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config(); 
const app = express();

// PostgreSQL Client Configuration
const pgClient = new Pool({
    host: process.env.PG_HOST,
    port: parseInt(process.env.PG_PORT, 10),
    database: process.env.PG_DATABASE,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD?.toString()
});

// Connect to PostgreSQL
pgClient.connect()
    .then(() => console.log('Connected to PostgreSQL'))
    .catch(err => console.error('Error connecting to PostgreSQL:', err));

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use('/api', reportRoutes);

// API configuration
const API_URL = process.env.API_URL;
const API_TOKEN = process.env.API_TOKEN;
const APPLICATION_ID = process.env.APPLICATION_ID;
const GATEWAYS_ID = process.env.GATEWAYS_ID;

// Store device data in memory

const deviceData = new Map(); // to store the device in the device data in the map  
const deviceErrorData=new Map();// this isfor only to store the error data

// MQTT Configuration
const mqttBrokerUrl = process.env.MQTT_URL;
const options = {
    clientId: 'mqttjs_' + Math.random().toString(16).substr(2, 8),
    username: 'YOUR_MQTT_USERNAME',
    password: 'YOUR_MQTT_PASSWORD',
    clean: true,
    reconnectPeriod: 5000
};

// Create axios instance with default config
const apiClient = axios.create({
    baseURL: API_URL,
    timeout: 5000,
    headers: {
        'Grpc-Metadata-Authorization': `Bearer ${API_TOKEN}`,
        'accept': 'application/json',
    }
});

// Helper function to fetch devices
async function fetchDevices() {
    try {
        const response = await apiClient.get('/api/devices', {
            params: {
                limit: 100,
                applicationId: APPLICATION_ID
            }
        });
        return response.data.result || [];
    } catch (error) {
        console.error('Error fetching devices:', error);
        return [];
    }
}

// MQTT Client Setup
function setupMQTTClient() {
    const client = mqtt.connect(mqttBrokerUrl, options);

    client.on('connect', async () => {
        console.log('Connected to MQTT broker');
        try {
            const devices = await fetchDevices();
            const topic = `application/${APPLICATION_ID}/device/+/event/up`;
            client.subscribe(topic, (err) => {
                if (err) {
                    console.error('Error subscribing to topic:', err);
                } else {
                    console.log(`Subscribed to topic: ${topic}`);
                    console.log(`Monitoring ${devices.length} devices`);
                }
            });
        } catch (error) {
            console.error('Error setting up device monitoring:', error);
        }
    });

    client.on('message', async (topic, message) => {
        try {
            const deviceEUI = topic.split('/')[3];
            const data = JSON.parse(message.toString());
            
            // Store in memory (this is for the )
            deviceData.set(deviceEUI, {
                lastUpdate: new Date(),
                data: data.object,
                rssi:data.rxInfo[0].rssi,
                deviceName:data.deviceInfo.deviceName

            });
            //store the error data in the memory
            deviceErrorData.set(deviceEUI,{
                lastUpdate:new Date(),
                fault:data.object.CH7,
                Name:data.deviceInfo.deviceName,
                deviceEUI:deviceEUI
            })
            console.log(deviceErrorData.Name)

            console.log(deviceData) 

            
            // Process and store in PostgreSQL
            await processAndStoreData(data);

            console.log(`Received data from device ${deviceEUI}:`, data.object);
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    client.on('error', (err) => {
        console.error('MQTT Client Error:', err);
    });

    client.on('close', () => {
        console.log('MQTT Client disconnected');
    });

    client.on('reconnect', () => {
        console.log('MQTT Client reconnecting...');
    });

    return client;
}

const PANEL_CONFIGS = {
    MULTIPLICATION_FACTOR :2,// 2 for dual panel, 1 for single panel
    PANEL_TO_PANEL_GAPS: 3 // 10 meters converted to millimeters // in mm, adjust based on site conditions
};

async function processAndStoreData(dataObject) {
    try {
        // Extract relevant values
        const deviceId = dataObject.deviceInfo.devEui;
        const deviceName = dataObject.deviceInfo.deviceName;
        
        // Parse numeric values safely
        const currentOdometerValue = parseFloat(dataObject.object.CH10);
        const currentBatteryDischarge = parseFloat(dataObject.object.CH6);

        // Validate numeric values
        if (isNaN(currentOdometerValue) || !isFinite(currentOdometerValue)) {
            console.log('Invalid odometer value:', dataObject.object.CH10);
            return;
        }

        if (isNaN(currentBatteryDischarge) || !isFinite(currentBatteryDischarge)) {
            console.log('Invalid battery discharge value:', dataObject.object.CH6);
            return;
        }

        // Basic validation
        if (!deviceId || !deviceName) {
            console.log('Missing required fields:', { deviceId, deviceName });
            return;
        }

        // Step 1: Fetch the last two readings for this device
        const historyQuery = `
            SELECT panels_cleaned, raw_odometer_value
            FROM Robot_clp_data
            WHERE device_id = $1 OR device_name = $2
            ORDER BY timestamp DESC
            LIMIT 2;
        `;
        const prevRes = await pgClient.query(historyQuery, [deviceId, deviceName]);

        // Calculate panels cleaned based on EEPROM value and history
        let panelsCleanedSinceLast = 0;
        let shouldStore = true;
        let totalPanelsCleaned = calculateTotalPanelsCleaned(currentOdometerValue);

        if (prevRes.rows.length > 0) {
            const lastRecord = prevRes.rows[0];
            const previousOdometerValue = parseFloat(lastRecord.raw_odometer_value);
            const previousTotalCleaned = parseFloat(lastRecord.panels_cleaned);

            // Detect EEPROM reset
            if (currentOdometerValue < previousOdometerValue) {
                console.log('EEPROM reset detected');
                totalPanelsCleaned = previousTotalCleaned + calculateTotalPanelsCleaned(currentOdometerValue);
                panelsCleanedSinceLast = calculateTotalPanelsCleaned(currentOdometerValue);
            } else {
                const newPanelsCleaned = calculateTotalPanelsCleaned(currentOdometerValue - previousOdometerValue);
                totalPanelsCleaned = previousTotalCleaned + newPanelsCleaned;
                panelsCleanedSinceLast = newPanelsCleaned;
            }

            // Validate calculated values
            if (isNaN(panelsCleanedSinceLast) || panelsCleanedSinceLast < 0) {
                console.log('Invalid panels cleaned calculation:', panelsCleanedSinceLast);
                shouldStore = false;
            }

            if (isNaN(totalPanelsCleaned) || totalPanelsCleaned < 0) {
                console.log('Invalid total panels calculation:', totalPanelsCleaned);
                shouldStore = false;
            }
        } else {
            panelsCleanedSinceLast = totalPanelsCleaned;
        }

        // Step 2: Insert the new record if valid
        if (shouldStore) {
            const insertQuery = `
                INSERT INTO Robot_clp_data (
                    device_id,
                    device_name,
                    panels_cleaned,
                    raw_odometer_value,
                    cumulative_panels_cleaned,
                    battery_discharge_cycle
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id;
            `;

            // Ensure all numeric values are valid before insertion
            const values = [
                deviceId,
                deviceName,
                Number(panelsCleanedSinceLast),
                Number(currentOdometerValue) ,
                Number(totalPanelsCleaned) ,
                Number(currentBatteryDischarge) 
            ];

            const insertRes = await pgClient.query(insertQuery, values);
            console.log(`Data inserted with ID: ${insertRes.rows[0].id}`);
        }
    } catch (error) {
        console.error('Error processing message:', error);
        // Log detailed information about the values
        console.error('Debug values:', {
            deviceId: dataObject?.deviceInfo?.devEui,
            deviceName: dataObject?.deviceInfo?.deviceName,
            odometerValue: dataObject?.object?.CH10,
            batteryDischarge: dataObject?.object?.CH6
        });
    }
}

function calculateTotalPanelsCleaned(odometerValue) {
    return Math.max(0, 
        odometerValue * PANEL_CONFIGS.MULTIPLICATION_FACTOR - 
        PANEL_CONFIGS.PANEL_TO_PANEL_GAPS
    );
}

// Initialize MQTT client
const mqttClient = setupMQTTClient();


// this is pART 3 

let weatherThresholds = {
    windSpeedThreshold: 10,
    humidityThreshold: 2,
    rainEnabled: false
};
// API Routes
let scheduledTasks = new Map();

// Scheduling endpoint
app.post('/api/schedule-downlink', async (req, res) => {
    const { groupIds, scheduleTime } = req.body;
    
    if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
        return res.status(400).json({ error: 'Invalid groupIds provided' });
    }
    if (!scheduleTime) {
        return res.status(400).json({ error: 'Schedule time is required' });
    }

try {
    
    const currentConfig = weatherThresholds;
      
    // If conditions are good, proceed with scheduling
    const scheduledMoment = moment(scheduleTime);
    if (scheduledMoment.isBefore(moment())) {
        scheduledMoment.add(1, 'day');
    }
    
    const taskId = uuidv4();
    const cronJob = cron.schedule(
        scheduledMoment.format('m H D M *'),
        async () => {
            try {
                // If conditions aren't met, return error immediately
                const updatedWeather = await fetchWeatherData();
                const updatedWeatherCheck = checkWeatherConditions(
                    updatedWeather,
                    currentConfig.windSpeedThreshold,
                    currentConfig.humidityThreshold,
                    currentConfig.rainEnabled
                );

                // If the weather is no longer good, don't execute the task
                if (!updatedWeatherCheck.valid) {
                    console.log(`Weather is not good at the scheduled time. Skipping downlink for task ${taskId}`);
                    scheduledTasks.set(taskId, {
                        ...scheduledTasks.get(taskId),
                        status: 'skipped',
                        skipMessage: updatedWeatherCheck.message
                    });
                    return;
                }

                await sendDataTOGroups(groupIds);
                console.log(`Downlink executed for task ${taskId} at ${moment()}`);
                scheduledTasks.delete(taskId);
            } catch (error) {
                console.error('Error executing scheduled downlink:', error);
            }
        }
    );
    
    const groupNames = await Promise.all(groupIds.map(async (groupId) => {
        const response = await apiClient.get(`/api/multicast-groups/${groupId}`);
        return response.data.name;
    }));

    scheduledTasks.set(taskId, {
        id: taskId,
        groupIds,
        groupNames,
        scheduleTime: scheduledMoment.format(),
        status: 'scheduled',
        cronJob,
        createdAt: moment().format()
    });
    
    res.status(200).json({
        message: 'Downlink scheduled successfully',
        taskId,
        scheduledTime: scheduledMoment.format(),
        groupIds,
        groupNames
    });
    
} catch (error) {
    console.error('Error in schedule-downlink:', error);
    res.status(500).json({ error: 'Failed to schedule downlink' });
}
});

// Add endpoint to get task status
app.get('/api/scheduled-tasks/:taskId', (req, res) => {
    const taskId = req.params.taskId;
    const task = scheduledTasks.get(taskId);
    
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }
    res.json({
        id: task.id,
        status: task.status,
        error: task.error,
        scheduleTime: task.scheduleTime,
        groupNames: task.groupNames
    });
});


// Get all scheduled tasks
app.get('/api/scheduled-tasks', (req, res) => {
    const tasks = Array.from(scheduledTasks.values()).map(task => ({
        id: task.id,
        groupIds: task.name,
        groupNames: task.groupNames,
        scheduleTime: task.scheduleTime,
        status: task.status,
        createdAt: task.createdAt
    }));
    
    res.json({ tasks });
});

// Cancel a scheduled task
app.delete('/api/scheduled-tasks/:taskId', (req, res) => {
    const { taskId } = req.params;
    const task = scheduledTasks.get(taskId);
    
    if (!task) {
        return res.status(404).json({ error: 'Scheduled task not found' });
    }

    // Stop the cron job
    task.cronJob.stop();
    // Remove from storage
    scheduledTasks.delete(taskId);

    res.json({
        message: 'Scheduled task cancelled successfully',
        taskId
    });
}); 
const sendDataTOGroups = async (groupIds) => {
    try {
        const promises = groupIds.map(groupId =>
            apiClient.post(`/api/multicast-groups/${groupId}/queue`, {
                queueItem: {
                    data: 'Ag==',
                    fCnt: 0,
                    fPort: 1,
                },
            })
        );
        await Promise.all(promises);
        console.log('Successfully sent downlink to the group:', groupIds);
    } catch (error) {
        console.error('Error sending downlink to groups:', error);
        throw error; // Add this line
    }
};

app.post('/api/update-threshold', async (req, res) => {
    try {
        const { windSpeedThreshold, humidityThreshold, rainEnabled } = req.body;

        // Validate inputs
        if (typeof windSpeedThreshold !== 'number' || windSpeedThreshold < 0) {
            return res.status(400).json({ 
                error: 'Invalid wind speed threshold' 
            });
        }

        if (typeof humidityThreshold !== 'number' || 
            humidityThreshold < 0 ||
            humidityThreshold > 100) {
            return res.status(400).json({ 
                error: 'Invalid humidity threshold' 
            });
        }

        if (typeof rainEnabled !== 'boolean') {
            return res.status(400).json({ 
                error: 'Invalid rain enabled setting' 
            });
        }

        // Update thresholds
        weatherThresholds = {
            windSpeedThreshold,
            humidityThreshold,
            rainEnabled
        };

        // Log the update
        console.log('Updated weather thresholds:', weatherThresholds);

        res.status(200).json({
            message: 'Thresholds updated successfully',
            currentThresholds: weatherThresholds
        });

    } catch (error) {
        console.error('Error updating thresholds:', error);
        res.status(500).json({
            error: 'Failed to update thresholds',
            details: error.message
        });
    }
});
const fetchWeatherData = async () => {
    try {
        const GATEWAY_API = process.env.GATEWAY_API_URL;
        const response = await axios.get(`${GATEWAY_API}/api/gateway`);
        console.log(response.data.weather)
        return response.data.weather; // Assuming weather data is in this format
    } catch (error) {
        console.error('Failed to fetch weather data:', error);
        throw error;
    }
};
const checkWeatherConditions = (weather, windSpeedThreshold, humidityThreshold, rainEnabled) => {
    // First check for rain if rain detection is enabled
    if (rainEnabled && weather.rain > 0) {
        return { 
            valid: false, 
            message: `Operation disabled due to rain detection: ${weather.rain} mm` 
        };
    }
    
    // Check if the wind speed exceeds the threshold
    if (weather.windSpeed > windSpeedThreshold) {
        return { 
            valid: false, 
            message: `Wind speed exceeds the threshold: ${weather.windSpeed} m/s` 
        };
    } 
    // Check if the humidity exceeds the threshold
    if (weather.humidity > humidityThreshold) {
        return { 
            valid: false, 
            message: `Humidity exceeds the threshold: ${weather.humidity}%` 
        };
    }
    // Return success message along with valid status
    return { 
        valid: true,
        message: "Weather conditions are suitable for operation"
    };
};

app.get('/api/get-errors', async (req, res) => {
    const errors = Array.from(deviceErrorData.values()).map(value => ({
        deviceEUI: value.deviceEUI,
        lastUpdate: value.lastUpdate,
        fault: value.fault,
        controlPannelName:value.Name
    }));
    console.log("this is the faulterror datatobedisplayed")
    console.log(errors)
    res.json(errors);
});

app.get('/api/devices/:deviceEUI/data', (req, res) => {
    const data = deviceData.get(req.params.deviceEUI);
    if (data) {
        res.json(data);
    } else {
        res.status(404).json({ error: 'No data found for device' });
    }
});

app.get('/api/multicast-groups', async (req, res) => {
    try {
        const response = await apiClient.get('/api/multicast-groups', {
            params: {
                limit: req.query.limit || 100,
                applicationId: APPLICATION_ID
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error('API Error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to fetch multicast groups',
            details: error.response?.data
        });
    }
});

app.get('/api/devices', async (req, res) => {
    try {
        const devices = await fetchDevices();
        res.json({ result: devices });
    } catch (error) {
        console.error('API Error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to fetch devices',
            details: error.response?.data
        });
    }
});



app.post('/api/devices/:deviceId/queue', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const response = await apiClient.post(
            `/api/devices/${deviceId}/queue`,
            req.body
        );
        res.json(response.data);
    } catch (error) {
        console.error('API Error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to toggle downlink for device',
            details: error.response?.data
        });
    }
});

app.post('/api/multicast-groups/:groupId/queue', async (req, res) => {
    try {
        const { groupId } = req.params;
        const response = await apiClient.post(
            `/api/multicast-groups/${groupId}/queue`,
            req.body
        );
        res.json(response.data);
    } catch (error) {
        console.error('API Error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to toggle downlink',
            details: error.response?.data
        });
    }
});

app.get('/api/gateway', async (req, res) => {
    try {
        // Fetch gateway details
        const gatewayResponse = await apiClient.get(`/api/gateways/${GATEWAYS_ID}`);
        const gatewayData = gatewayResponse.data;

        // Extract latitude and longitude
        const { latitude, longitude } = gatewayData.gateway.location;

        if (latitude && longitude) {
            // Fetch weather details using a weather API (e.g., OpenWeatherMap)
            const weatherApiKey = process.env.WEATHER_API_KEY; // Hardcoded for testing
            const weatherResponse = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
                params: {
                    lat: latitude,
                    lon: longitude,
                    appid: weatherApiKey,
                    units: 'metric'
                }
            });

            const weatherData = weatherResponse.data;
            // Add weather information to the response
            gatewayData.weather = {
                temperature: weatherData.main.temp,
                humidity: weatherData.main.humidity,
                windSpeed: weatherData.wind.speed,
                rain: weatherData.rain?.['1h'] || 0
            };
        } else {
            gatewayData.weather = { error: 'Invalid location data' };
        }
        res.json(gatewayData);
    } catch (error) {
        console.error("Detailed API Error:", {
            status: error.response?.status,
            details: error.response?.data || error.message
        });

        res.status(500).json({
            error: "Failed to fetch gateway or weather details",
            details: error.response?.data || error.message
        });
    }
});



app.get("/api/server", async(req, res) => {
    try {
        const response = await apiClient.get(process.env.API_URL);
        if (response.status === 200) {
            console.log("server is running successfully");
            return res.status(200).json({
                message: "workingfine",
                time: Date.now()
            });
        }

        // If status is not 200, send error response
        return res.status(500).json({
            message: "Notworking"
        });
        
    } catch (error) {
        return res.status(500).json({
            error: error.message
        });
    }
});

app.get('/api/allGateways',async(req,res)=>{
    try {
        const gatewayResponse = await apiClient.get(`api/gateways`,{
            params:{
                limit:20,
                tenantId:'52f14cd4-c6f1-4fbd-8f87-4025e1d49242'
            }
        });
        const gatewayData = gatewayResponse.data;

        res.status(200).json({
            message:"success",
            gatewayData
        })

    } catch (error) {
        res.status(500).json({
            error:"failed to fetch the gatways ",
            details:error.response?.data || error.message
        })
    }


})

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received. Closing HTTP server, MQTT client, and PostgreSQL connection');
    mqttClient.end();
    pgClient.end(); // Close PostgreSQL connection
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

const PORT = 5002;
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Error handling
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    mqttClient.end();
    pgClient.end(); // Close PostgreSQL connection
    process.exit(1);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
});