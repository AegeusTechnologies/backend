
const express = require('express');
const cors = require('cors');
const axios = require('axios');
//cconst mqtt = require('mqtt'); 
//const { Pool } = require('pg');
//const reportRoutes = require('./routes/reportRoutes');
//const cron = require('node-cron');  
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const { setupMQTTClient2 } = require('./mqttConnection/mqtt');
const redisClient = require('./config/redisConfig');
const Reportrouter = require('./routes/reports');
const allReportRouter = require('./routes/reportRoutes');
const deviceRouter = require('./routes/getAllDevices');
const TriggerAll = require('./routes/mutlicastGroupTri');
const { setupMQTTClient3 } = require('./mqttConnection/mqttWeather');
const { weatherRouter } = require('./routes/weatherData');
const thresoldRouter = require('./routes/weatherThresoldRoute');
require('dotenv').config(); 
const app = express();


// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));


setupMQTTClient2()
setupMQTTClient3()
//app.use('/api', reportRoutes);

app.use('/api',Reportrouter)
app.use('/api',allReportRouter)
app.use('/api',deviceRouter)
app.use('/api',TriggerAll)
app.use('/api',weatherRouter)
app.use('/api',thresoldRouter)

// API configuration
const APPLICATION_ID = process.env.APPLICATION_ID;
const GATEWAYS_ID = process.env.GATEWAYS_ID;

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
// this is pART 3  (scheduler code )

// let weatherThresholds = {
//     windSpeedThreshold: 10,
//     humidityThreshold: 2,
//     rainEnabled: false
// };

// let scheduledTasks = new Map();  // storing the scheduled task here in memory

// // Scheduling endpoint
// app.post('/api/schedule-downlink', async (req, res) => {
//     const { groupIds, scheduleTime } = req.body;
    
//     if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
//         return res.status(400).json({ error: 'Invalid groupIds provided' });
//     }
//     if (!scheduleTime) {
//         return res.status(400).json({ error: 'Schedule time is required' });
//     }

// try {
//      // Parse the scheduled time
//      const scheduledMoment = moment(scheduleTime);

//      if (scheduledMoment.isBefore(moment())) {
//         scheduledMoment.add(1, 'day');
//     }

//     // Calculate milliseconds until execution
//     const msUntilExecution = scheduledMoment.diff(moment());
//     console.log(`Task will execute in ${msUntilExecution}ms`);
    
//     const taskId = uuidv4();

//     const groupNames = await Promise.all(groupIds.map(async (groupId) => {
//         try {
//             const response = await apiClient.get(`/api/multicast-groups/${groupId}`);
//             return response.data.name;
//         } catch (error) {
//             console.error(`Failed to get name for group ${groupId}:`, error);
//             return `Unknown (${groupId})`;
//         }
//     }));
//       // Store task with pending status
//       scheduledTasks.set(taskId, {
//         id: taskId,
//         groupIds,
//         groupNames,
//         scheduleTime: scheduledMoment.format(),
//         status: 'scheduled',
//         createdAt: moment().format()
//     });

//           // Use setTimeout instead of cron for more reliable single execution
//           const timer = setTimeout(async () => {
//             console.log(`[${moment().format()}] Executing scheduled downlink for task ${taskId}`);
//             try {
//                 // Check weather conditions right before execution
//                 const updatedWeather = await fetchWeatherData();
//                 console.log(`Weather data for task ${taskId}:`, updatedWeather);
                
//                 const updatedWeatherCheck = checkWeatherConditions(
//                     updatedWeather,
//                     weatherThresholds.windSpeedThreshold,
//                     weatherThresholds.humidityThreshold,
//                     weatherThresholds.rainEnabled
//                 );

//                 // If weather conditions aren't met, skip the task
//                 if (!updatedWeatherCheck.valid) {
//                     console.log(`Weather conditions not met. Skipping downlink for task ${taskId}: ${updatedWeatherCheck.message}`);
//                     scheduledTasks.set(taskId, {
//                         ...scheduledTasks.get(taskId),
//                         status: 'skipped',
//                         skipMessage: updatedWeatherCheck.message
//                     });
//                     return;
//                 }

//                 // Send data to groups
//                 console.log(`Sending data to groups for task ${taskId}:`, groupIds);
//                 const response = await sendDataTOGroups(groupIds);
//                 if(response.data,fCnt){
//                 scheduledTasks.set(taskId, {
//                     ...scheduledTasks.get(taskId),
//                     status: 'completed',
//                     executedAt: moment().format()
//                 });

//                 }else{

//                     scheduledTasks.set(taskId, {
//                         ...scheduledTasks.get(taskId),
//                         status: 'failed',
//                         error: error.message,
//                         failedAt: moment().format()})
//                 }   
//                // console.log(`Successfully executed downlink for task ${taskId}`);
//             } catch (error) {
//                 console.error(`Error executing scheduled downlink for task ${taskId}:`, error);
//                 // Update task status to failed
//                 scheduledTasks.set(taskId, {
//                     ...scheduledTasks.get(taskId),
//                     status: 'Error',
//                     error: error.message,
//                     failedAt: moment().format()
//                 });
//             }
//         }, msUntilExecution);
        
//         // Store the timer reference so we can cancel it if needed
//         scheduledTasks.get(taskId).timer = timer;
        
//         res.status(200).json({
//             message: 'Downlink scheduled successfully',
//             taskId,
//             scheduledTime: scheduledMoment.format(),
//             groupIds,
//             groupNames
//         });

// } catch (error) {
//     console.error('Error in schedule-downlink:', error);
//     res.status(500).json({ error: 'Failed to schedule downlink' });
// }
// });

// // Add endpoint to get task status
// app.delete('/api/scheduled-tasks/:taskId', (req, res) => {
//     const { taskId } = req.params;
//     const task = scheduledTasks.get(taskId);
    
//     if (!task) {
//         return res.status(404).json({ error: 'Scheduled task not found' });
//     }

//     // Clear the timeout instead of stopping a cron job
//     if (task.timer) {
//         clearTimeout(task.timer);
//     }
    
//     // Update status before storing final state
//     task.status = 'cancelled';
//     task.cancelledAt = moment().format();
    
//     // Remove from storage
//     scheduledTasks.delete(taskId);

//     res.json({
//         message: 'Scheduled task cancelled successfully',
//         taskId,
//         status: 'cancelled'
//     });
// })
// // Get all scheduled tasks
// app.get('/api/scheduled-tasks', (req, res) => {
//     const tasks = Array.from(scheduledTasks.values()).map(task => ({
//         id: task.id,
//         groupIds: task.name,
//         groupNames: task.groupNames,
//         scheduleTime: task.scheduleTime,
//         status: task.status,
//         createdAt: task.createdAt
//     }));
    
//     res.json({ tasks });
// });

// // Cancel a scheduled task
// app.delete('/api/scheduled-tasks/:taskId', (req, res) => {
//     const { taskId } = req.params;
//     const task = scheduledTasks.get(taskId);
    
//     if (!task) {
//         return res.status(404).json({ error: 'Scheduled task not found' });
//     }

//     // Stop the cron job
//     task.cronJob.stop();
//     // Remove from storage
//     scheduledTasks.delete(taskId);

//     res.json({
//         message: 'Scheduled task cancelled successfully',
//         taskId
//     });
// }); 

// this is to send the downlink 
// const sendDataTOGroups = async (groupIds) => {
//     const results = [];
//     const errors = [];
    
//     for (const groupId of groupIds) {
//         try {
//             const response = await apiClient.post(`/api/multicast-groups/${groupId}/queue`, {
//                 queueItem: {
//                     data: 'Ag==',
//                     fCnt: 0,
//                     fPort: 1,
//                 },
//             });
//             console.log(`Successfully sent downlink to group ${groupId}`);
//             console.log(response.data.fCnt,"chripstack recvied")
//             results.push({ groupId, success: true, response: response.data.fCnt});
//         } catch (error) {
//             console.error(`Failed to send downlink to group ${groupId}:`, error);
//             errors.push({ groupId, error: error.message });
//         }
//     }
    
//     // If any group failed, throw an error with details
//     if (errors.length > 0) {
//         const errorMessage = `Failed to send downlink to ${errors.length} group(s)`;
//         const combinedError = new Error(errorMessage);
//         combinedError.errors = errors;
//         combinedError.partialResults = results;
//         throw combinedError;
//     }
    
//     return results;
// };

// app.post('/api/update-threshold', async (req, res) => {
//     try {
//         const { windSpeedThreshold, humidityThreshold, rainEnabled } = req.body;

//         // Validate inputs
//         if (typeof windSpeedThreshold !== 'number' || windSpeedThreshold < 0) {
//             return res.status(400).json({ 
//                 error: 'Invalid wind speed threshold' 
//             });
//         }

//         if (typeof humidityThreshold !== 'number' || 
//             humidityThreshold < 0 ||
//             humidityThreshold > 100) {
//             return res.status(400).json({ 
//                 error: 'Invalid humidity threshold' 
//             });
//         }

//         if (typeof rainEnabled !== 'boolean') {
//             return res.status(400).json({ 
//                 error: 'Invalid rain enabled setting' 
//             });
//         }

//         // Update thresholds
//         weatherThresholds = {
//             windSpeedThreshold,
//             humidityThreshold,
//             rainEnabled
//         };

//         // Log the update
//         console.log('Updated weather thresholds:', weatherThresholds);

//         res.status(200).json({
//             message: 'Thresholds updated successfully',
//             currentThresholds: weatherThresholds
//         });

//     } catch (error) {
//         console.error('Error updating thresholds:', error);
//         res.status(500).json({
//             error: 'Failed to update thresholds',
//             details: error.message
//         });
//     }
// });
// const fetchWeatherData = async () => {
//     try {
//         const GATEWAY_API = process.env.GATEWAY_API_URL;
//         const response = await axios.get(`${GATEWAY_API}/api/gateway`);
//         console.log(response.data.weather)
//         return response.data.weather; 
//     } catch (error) {
//         console.error('Failed to fetch weather data:', error);
//         throw error;
//     }
// };
// const checkWeatherConditions = (weather, windSpeedThreshold, humidityThreshold, rainEnabled) => {
//     // First check for rain if rain detection is enabled
//     if (rainEnabled && weather.rain > 0) {
//         return { 
//             valid: false, 
//             message: `Operation disabled due to rain detection: ${weather.rain} mm` 
//         };
//     }
    
//     // Check if the wind speed exceeds the threshold
//     if (weather.windSpeed > windSpeedThreshold) {
//         return { 
//             valid: false, 
//             message: `Wind speed exceeds the threshold: ${weather.windSpeed} m/s` 
//         };
//     } 
//     // Check if the humidity exceeds the threshold
//     if (weather.humidity > humidityThreshold) {
//         return { 
//             valid: false, 
//             message: `Humidity exceeds the threshold: ${weather.humidity}%` 
//         };
//     }
//     // Return success message along with valid status
//     return { 
//         valid: true,
//         message: "Weather conditions are suitable for operation"
//     };
// };


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