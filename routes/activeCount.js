const express = require('express');
const prisma = require('../config/prismaConfig');
const Robotcount = express.Router();

Robotcount.get('/activeCount', async (req, res) => {
    try {
        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);

        // Get all unique devices active today
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

        // Aggregate today's counts for each device
        const results = await Promise.all(devices.map(async (device) => {
            const aggregateCounts = await prisma.robotRunLog.aggregate({
                where: {
                    device_id: device.device_id,
                    OR: [
                        { createdAt: { gte: startOfDay } },
                        { updatedAt: { gte: startOfDay } }
                    ]
                },
                _sum: {
                    AutoCount: true,
                    ManualCount: true
                }
            });

            return {
                device_id: device.device_id,
                device_name: device.device_name,
                block: device.block || "Unknown",
                autoCountToday: aggregateCounts._sum.AutoCount || 0,
                manualCountToday: aggregateCounts._sum.ManualCount || 0,
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
