const axios = require('axios');
const moment= require('moment');
const schedule = require('node-schedule')
const {v4: uuidv4} = require('uuid');

const errors = [];
const missing = new Map();
const results = [];

const apiClient = axios.create({
    baseURL: process.env.API_URL,
    timeout: 5000,
    headers: {
        'Grpc-Metadata-Authorization': `Bearer ${process.env.API_TOKEN}`,
        'accept': 'application/json',
    }
});

async function triggermulticastGroup(req, res, next) {
    if (!req.body || !req.body.groupId || !Array.isArray(req.body.groupId)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid request. groupId array is required'
        });
    }
    const groupId = req.body.groupId;
    console.log("Received groupId:", groupId);

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
                                    data: "Ag==",
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
}, 30 * 60 * 1000);



let SchedularTask= new Map(); // storing the task id for the schedular


async function Scheduler(req, res) {
    const { groupId, scheduleTime } = req.body;
    
    if (!groupId || !Array.isArray(groupId) || groupId.length === 0) {
        return res.status(400).json({ error: 'Invalid groupIds provided' });
    }
    if (!scheduleTime) {
        return res.status(400).json({ error: 'Schedule time is required' });
    }

    try {
        const scheduleMoment = moment(scheduleTime);

        if (scheduleMoment.isBefore(moment())) {
            scheduleMoment.add(1, 'days');
        }

        const taskId = uuidv4();
        
        // Schedule the task
        const job = schedule.scheduleJob(scheduleMoment.toDate(), async () => {
            try {
                // Reuse the existing triggermulticastGroup logic
                await Promise.all(groupId.map(async (gId) => {
                    try {
                        const devices = [];
                        const deviceResponse = await apiClient.get('/api/devices', {
                            params: {
                                limit: 1000,
                                applicationId: process.env.APPLICATION_ID,
                                multicastGroupId: gId
                            }
                        });

                        if (deviceResponse.data.result) {
                            devices.push(...deviceResponse.data.result);
                            
                            await Promise.all(devices.map(async (device) => {
                                try {
                                    await apiClient.post(`/api/devices/${device.devEui}/queue`, {
                                        queueItem: {
                                            data: "Ag==",
                                            fCnt: 0,
                                            fPort: 1,
                                            confirmed: true,
                                        }
                                    });
                                } catch (error) {
                                    console.error(`Scheduled downlink failed for device ${device.devEui}:`, error);
                                }
                            }));
                        }
                    } catch (error) {
                        console.error(`Scheduled group processing failed for ${gId}:`, error);
                    }
                }));
            } catch (error) {
                console.error('Scheduled task failed:', error);
            } finally {
                // Clean up the scheduled task
                SchedularTask.delete(taskId);
            }
        });

        // Store the scheduled job
        SchedularTask.set(taskId, {
            job,
            groupIds: groupId,
            scheduledTime: scheduleMoment.format(),
        });

        return res.status(200).json({
            success: true,
            taskId,
            scheduledTime: scheduleMoment.format(),
            groupIds: groupId
        });

    } catch (error) {
        console.error('Scheduler error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

// Add function to get scheduled tasks
async function getScheduledTasks(req, res) {
    try {
        const tasks = Array.from(SchedularTask.entries()).map(([id, task]) => ({
            taskId: id,
            scheduledTime: task.scheduledTime,
            groupIds: task.groupIds
        }));

        return res.status(200).json({
            success: true,
            tasks
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

async function cancelScheduledTask(req,res){
    const taskID= req.params.taskId;
    if(!taskID){
        return res.status(400).json({error:'Invalid taskId provided'});
    }

    const task = SchedularTask.get(taskID)

    res.status(200).json({
        success:true,
        message:`Task with ID ${taskID} has been cancelled`,
        taskDetails: task
    })
}

module.exports = {
    triggermulticastGroup,
    getMissingDevices,
    Scheduler,
    getScheduledTasks,
    cancelScheduledTask
};