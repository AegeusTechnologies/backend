const express = require('express');
const prisma = require('../config/prismaConfig');
const Robotcount = express.Router();


Robotcount.get('/activeCount', async (req, res) => {
    try {
        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);
        
      
        const devices = await prisma.robotRunLog.findMany({
            where: {
                OR: [
                    { createdAt: { gte: startOfDay } },
                    { updatedAt: { gte: startOfDay } }
                ]
            },
            select: {
                device_id: true,
                device_name: true,
                block: true
            },
            distinct: ['device_id']
        });

        // Get latest record for each device to get current totals
        const results = await Promise.all(devices.map(async (device) => {
            const latestRecord = await prisma.robotRunLog.findFirst({
                where: { 
                    device_id: device.device_id,
                    OR: [
                        { createdAt: { gte: startOfDay } },
                        { updatedAt: { gte: startOfDay } }
                    ]
                },
                orderBy: { createdAt: 'desc' },
                select: {
                    device_id: true,
                    device_name: true,
                    block: true,
                    AutoCount: true,
                    ManualCount: true
                }
            });

            return {
                device_id: latestRecord?.device_id || device.device_id,
                device_name: latestRecord?.device_name || device.device_name,
                block: latestRecord?.block || device.block || "Unknown",
                autoCountToday: latestRecord?.AutoCount || 0,
                manualCountToday: latestRecord?.ManualCount || 0,
            };
        }));

        res.json({ success: true, data: results });
        
    } catch (error) {
        console.error("Error in GET /activeCount route:", {
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});


module.exports = Robotcount;