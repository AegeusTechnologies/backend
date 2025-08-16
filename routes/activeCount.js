const express = require('express');
const prisma = require('../config/prismaConfig');
const Robotcount= express.Router();

Robotcount.get('/activeCount', async (req, res) => {
    try {
        const result = await prisma.runningData.findMany({
            orderBy: {
                createdAt: 'desc'
            },
            select: {
                device_name: true,
                block: true,
                autoCount: true,
                manualCount: true,
                updateAt: true,
            }
        });

        if (result.length === 0) {
            return res.status(404).json({ success: false, message: "No active counts found", count: 0 });
        }
        return res.status(200).json({ success: true, data: result, count: result.length });

    } catch (error) {
        console.error("Error in /activeCount route:", {
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

Robotcount.post('/activeCount', async (req, res) => {
    try {
        const { date } = req.body;
        if (!date) {
            return res.status(400).json({ success: false, message: "Date is required" });
        }

        // Get start and end of the given date
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);

        const result = await prisma.runningData.findMany({
            where: {
                createdAt: {
                    gte: startDate,
                    lte: endDate
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        if (result.length === 0) {
            return res.status(404).json({ success: false, message: "No data found for the given date" });
        }
        return res.status(200).json({ success: true, data: result });

    } catch (error) {
        console.error("Error in POST /activeCount:", error.message);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

module.exports = Robotcount;
