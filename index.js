
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { setupMQTTClient2 } = require('./mqttConnection/mqtt');
const redisClient = require('./config/redisConfig');
const Reportrouter = require('./routes/reports');
const allReportRouter = require('./routes/reportRoutes');
const deviceRouter = require('./routes/getAllDevices');
const TriggerAll = require('./routes/mutlicastGroupTri');
const { setupMQTTClient3 } = require('./mqttConnection/mqttWeather');
const { weatherRouter } = require('./routes/weatherData');
const thresoldRouter = require('./routes/weatherThresoldRoute');
const event = require('./routes/mqttEventsRoutes');
const { mqttEvents } = require('./mqttConnection/mqttEvents');
const robotError = require('./routes/robotErrorRoutes');
const statusRouter = require('./routes/statusRobot');
const BatteryRouter = require('./routes/robotbatter');
//const getRobotStatuses  = require('./services/activeRobot.js');
const Robotcount = require('./routes/activeCount');
require('dotenv').config(); 
const app = express();


// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));


setupMQTTClient2();
setupMQTTClient3();
mqttEvents(); // this for the events data
//app.use('/api', reportRoutes);

app.use('/api',Reportrouter);
app.use('/api',allReportRouter);
app.use('/api',deviceRouter);
app.use('/api',TriggerAll);
app.use('/api',weatherRouter);
app.use('/api',thresoldRouter);
app.use('/api',event);
app.use('/api',robotError)
app.use('/api',statusRouter);
app.use('/api',BatteryRouter)
app.use('/api',Robotcount);


// API configuration
const APPLICATION_ID = process.env.APPLICATION_ID;
const GATEWAYS_ID = process.env.GATEWAYS_ID;


//setInterval(getRobotStatu, 1000 * 60 * 5); // Check active robots every 5 minutes

// Store device data in memory

const deviceErrorData=new Map();// this isfor only to store the error data

const apiClient = axios.create({
    baseURL: process.env.API_URL,
    timeout: 5000,
    headers: {
        'Grpc-Metadata-Authorization': `Bearer ${process.env.API_TOKEN}`,
        'accept': 'application/json',
    }
});


// Helper function to fetch devices
async function fetchDevices() {
    try {
        const response = await apiClient.get('/api/devices', {
            params: {
                limit: 1000,
                applicationId: APPLICATION_ID
            }
        });
        return response.data.result || [];
    } catch (error) {
        console.error('Error fetching devices:', error);
        return [];
    }
}

app.get('/api/devices/:deviceEUI/data', async (req, res) => {
    const data = await  redisClient.get(req.params.deviceEUI);
    if (data) {
        res.json(data);
    } else {
        res.status(404).json({ error: 'No data found for device' });
    }
});

app.get('/api/get-errors', async (req, res) => {
    try {
        // Convert the deviceErrorData Map to an array of values
        const errorInfoList = Array.from(deviceErrorData.values());

        if (errorInfoList.length === 0) {
            return res.status(404).json({ error: 'No error data found' });
        }

        // Respond with the array of error information
        res.json(errorInfoList);

    } catch (error) {
        console.error('Error fetching data from deviceErrorData:', error);
        res.status(500).json({ error: 'Failed to fetch data from deviceErrorData' });
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
 
// this api is to get the all device
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




// this api is to get the devices of that particular multicasrt group

app.get('/api/devices/:groupId', async (req, res) => {
    const { groupId } = req.params;
    try {
        const response = await apiClient.get('/api/devices', {
            params: {
                limit: 1000,
                applicationId: APPLICATION_ID,
                multicastGroupId: groupId
            }
        });
        res.json({ result: response.data.result }); // Send proper response
    } catch (error) {
        console.error('Error fetching devices:', error);
        res.status(500).json({ // Add error handling
            error: 'Failed to fetch devices',
            details: error.response?.data || error.message
        });
    }
});

// this 


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
        const gatewayResponse = await apiClient.get(`/api/gateways/${process.env.GATEWAYS_ID}`);
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

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: 'Something broke!'
    });
});


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
