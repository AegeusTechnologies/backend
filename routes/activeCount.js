const express = require('express');
const prisma = require('../config/prismaConfig');
const Robotcount = express.Router();

// ✅ GET latest active count per device, including block
Robotcount.get('/activeCount', async (req, res) => {
    try {
        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);

        const logs = await prisma.robotRunLog.groupBy({
            by: ['device_id', 'device_name', 'block'], // <- include block here
            where: {
                createdAt: { gte: startOfDay },
            },
            _sum: {
                AutoCount: true,
                ManualCount: true,
            },
        });

        const results = logs.map(log => ({
            device_id: log.device_id,
            device_name: log.device_name,
            block: log.block || "Unknown",
            autoCountToday: log._sum.AutoCount || 0,
            manualCountToday: log._sum.ManualCount || 0,
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
