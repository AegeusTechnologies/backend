const axios = require('axios');
const moment = require('moment-timezone');
const schedule = require('node-schedule');
const {v4: uuidv4} = require('uuid');

const errors = [];
const missing = new Map();
const results = [];
// Using Map to store scheduled timeouts
let SchedularTask = new Map();

const apiClient = axios.create({
    baseURL: process.env.API_URL,
    timeout: 5000,
    headers: {
        'Grpc-Metadata-Authorization': `Bearer ${process.env.API_TOKEN}`,
        'accept': 'application/json',
    }
});

async function triggermulticastGroup(req, res) {
    if (!req.body || !req.body.groupId || !req.body.data || !Array.isArray(req.body.groupId) || req.body.groupId.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Invalid request. groupId array is required or data is required.'
        });
    }
    const {groupId, data} = req.body;

    // Validate or sanitize the data
    if (typeof data !== 'string' || !/^[A-Za-z0-9+/=]*$/.test(data)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid data format. Data must be a Base64-encoded string.'
        });
    }
    

    try {
      

        // Wait for all group operations to complete
        await Promise.all(groupId.map(async (gId) => {
            try {
                const devices = [];
                // Get devices for the group
                const deviceResponse = await apiClient.get('/api/devices', {
                    params: {
                        limit: 1000,
                        applicationId: process.env.APPLICATION_ID,
                        multicastGroupId: gId
                    }
                });
                console.log("Device response:", deviceResponse.data);

                if (deviceResponse.data.result) {
                    devices.push(...deviceResponse.data.result);
                    
                    // Wait for all device operations to complete
                    await Promise.all(devices.map(async (device) => {
                        try {
                            const downlinkResponse = await apiClient.post(`/api/devices/${device.devEui}/queue`, {
                                queueItem: {
                                    data: data.trim(), // Ensure no extra spaces
                                    fCnt: 0,
                                    fPort: 1,
                                    confirmed: true,
                                }
                            });

                            if (!downlinkResponse.data.id) {
                                errors.push(`Error on sending downlink to ${device.devEui}`);
                                missing.set(device.devEui, downlinkResponse.data.error || 'Unknown error');
                            } else {
                                results.push({
                                    deviceEui: device.devEui,
                                    groupId: gId,
                                    status: 'success'
                                });
                            }
                        } catch (deviceError) {
                            errors.push(`Failed to send downlink to ${device.devEui}: ${deviceError.message}`);
                            missing.set(device.devEui, deviceError.message);
                        }
                    }));
                }
            } catch (groupError) {
                errors.push(`Failed to process group ${gId}: ${groupError.message}`);
            }
        }));

        // Send response
        return res.status(200).json({
            success: errors.length === 0,
            processedGroups: groupId.length,
            successfulDevices: results,
            errors: errors.length > 0 ? errors : null,
            missingDevices: Object.fromEntries(missing)
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}


async function getMissingDevices(){
    try{
        const device= await missing.get('deviceEui');
        if(device){
            return device;
    }else{
            return null;
        }
    } catch (error) {
        console.error("Error getting missing device:", error);
        return null;
    }
}

setInterval(() => {
    missing.clear();
    errors.length = 0;
    results.length = 0;
}, 1000);


async function Scheduler(req, res) {
    const { groupId, scheduleTimeMs } = req.body;
    console.log("Received groupId:", groupId);
    console.log("Received scheduleTimeMs:", scheduleTimeMs);
    
    if (!groupId || !Array.isArray(groupId) || groupId.length === 0) {
        return res.status(400).json({ error: 'Invalid groupIds provided' });
    }
    if (!scheduleTimeMs || isNaN(scheduleTimeMs)) {
        return res.status(400).json({ error: 'Valid schedule time in milliseconds is required' });
    }

    try {
        // Create moment objects from the timestamp
        const scheduledTime = moment(Number(scheduleTimeMs));
        const now = moment();
        
        // Calculate milliseconds until the scheduled time
        let delay = scheduledTime.valueOf() - now.valueOf();
        
        // If time is in the past, schedule for the next day
        if (delay < 0) {
            console.log("Time is in the past, adding 24 hours");
            scheduledTime.add(1, 'days');
            delay = scheduledTime.valueOf() - now.valueOf();
        }
        
        console.log(`Current time: ${now.format('YYYY-MM-DD HH:mm:ss z')}`);
        console.log(`Scheduled time: ${scheduledTime.format('YYYY-MM-DD HH:mm:ss z')}`);
        console.log(`Delay: ${delay} ms (${delay / 1000 / 60} minutes)`);
        
        const taskId = uuidv4();
        
        // Schedule the task using setTimeout
        const timeoutId = setTimeout(async () => {
            console.log(`[${taskId}] Executing scheduled task at ${moment().format('YYYY-MM-DD HH:mm:ss z')}`);
            
            try {
                // Process each group
                for (const gId of groupId) {
                    console.log(`[${taskId}] Processing group: ${gId}`);
                    try {
                        const devices = [];
                        
                        // Get devices for the group
                        const deviceResponse = await apiClient.get('/api/devices', {
                            params: {
                                limit: 1000,
                                applicationId: process.env.APPLICATION_ID,
                                multicastGroupId: gId
                            }
                        });

                        if (deviceResponse.data && deviceResponse.data.result) {
                            devices.push(...deviceResponse.data.result);
                            console.log(`[${taskId}] Found ${devices.length} devices for group: ${gId}`);
                            
                            // Process each device
                            for (const device of devices) {
                                try {
                                    console.log(`[${taskId}] Sending downlink to device: ${device.devEui}`);
                                    await apiClient.post(`/api/devices/${device.devEui}/queue`, {
                                        queueItem: {
                                            data: "Ag==",
                                            fCnt: 0,
                                            fPort: 1,
                                            confirmed: true,
                                        }
                                    });
                                    console.log(`[${taskId}] Successfully sent downlink to ${device.devEui}`);
                                } catch (deviceError) {
                                    console.error(`[${taskId}] Failed to send downlink to ${device.devEui}: ${deviceError.message}`);
                                }
                                
                                // Add a small delay between requests
                                await new Promise(resolve => setTimeout(resolve, 100));
                            }
                        } else {
                            console.warn(`[${taskId}] No devices found for group: ${gId}`);
                        }
                    } catch (groupError) {
                        console.error(`[${taskId}] Failed to process group ${gId}: ${groupError.message}`);
                    }
                }
            } catch (error) {
                console.error(`[${taskId}] Overall execution error: ${error.message}`);
            } finally {
                // Clean up the scheduled task
                SchedularTask.delete(taskId);
                console.log(`[${taskId}] Task removed from scheduler`);
            }
        }, delay);
        
        // Store the scheduled task info
        SchedularTask.set(taskId, {
            timeoutId,
            groupIds: groupId,
            scheduledTime: scheduledTime.format('YYYY-MM-DD HH:mm:ss z'),
            createdAt: now.format('YYYY-MM-DD HH:mm:ss z')
        });
        
        return res.status(200).json({
            success: true,
            taskId,
            scheduledTime: scheduledTime.format('YYYY-MM-DD HH:mm:ss z'),
            groupIds: groupId,
            delayMs: delay
        });
    } catch (error) {
        console.error('Scheduler error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
// Updated cancel function for setTimeout
async function cancelScheduledTask(req, res) {
    const taskId = req.params.taskId;
    
    if (!taskId) {
        return res.status(400).json({ error: 'Invalid taskId provided' });
    }

    try {
        const task = SchedularTask.get(taskId);
        
        if (!task) {
            return res.status(404).json({
                success: false,
                error: `Task with ID ${taskId} not found`
            });
        }
        
        // Clear the timeout
        clearTimeout(task.timeoutId);
        
        // Remove from our task map
        SchedularTask.delete(taskId);
        
        console.log(`Task ${taskId} successfully canceled`);
        
        return res.status(200).json({
            success: true,
            message: `Task with ID ${taskId} has been cancelled`,
            taskDetails: {
                taskId,
                scheduledTime: task.scheduledTime,
                groupIds: task.groupIds
            }
        });
    } catch (error) {
        console.error(`Error canceling task ${taskId}:`, error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

// Get all scheduled tasks
async function getScheduledTasks(req, res) {
    try {
        const now = moment().tz('Asia/Kolkata');
        const tasks = Array.from(SchedularTask.entries()).map(([id, task]) => {
            // Parse the stored time consistently
            const scheduledMoment = moment.tz(task.scheduledTime, 'YYYY-MM-DD HH:mm:ss z', 'Asia/Kolkata');
            return {
                taskId: id,
                scheduledTime: task.scheduledTime,
                groupIds: task.groupIds,
                remainingTime: scheduledMoment.valueOf() - now.valueOf(),
                remainingMinutes: Math.round((scheduledMoment.valueOf() - now.valueOf()) / (1000 * 60))
            };
        });

        return res.status(200).json({
            success: true,
            currentTime: now.format('YYYY-MM-DD HH:mm:ss z'),
            tasks
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}


module.exports = {
    triggermulticastGroup,
    getMissingDevices,
    Scheduler,
    getScheduledTasks,
    cancelScheduledTask
};