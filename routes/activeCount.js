const express = require('express');
const prisma = require('../config/prismaConfig');
const Robotcount = express.Router();

// ✅ GET latest active count per device
Robotcount.get('/activeCount', async (req, res) => {
    try {
        const result = await prisma.$queryRaw`
            SELECT DISTINCT ON (device_id)
                device_id,
                device_name,
                block,
                "autoCount",
                "manualCount",
                "updateAt"
            FROM "RunningData"
            ORDER BY device_id, "createdAt" DESC;
        `;

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No active counts found",
                count: 0
            });
        }

        return res.status(200).json({
            success: true,
            data: result,
            count: result.length
        });

    } catch (error) {
        console.error("Error in GET /activeCount route:", {
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

// ✅ POST filtered by date, latest entry per device
Robotcount.post('/activeCount', async (req, res) => {
    try {
        const { date } = req.body;

        if (!date) {
            return res.status(400).json({
                success: false,
                message: "Date is required"
            });
        }

        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);

        const result = await prisma.$queryRaw`
            SELECT DISTINCT ON (device_id)
                device_id,
                device_name,
                block,
                "autoCount",
                "manualCount",
                "updateAt"
            FROM "RunningData"
            WHERE "createdAt" BETWEEN ${startDate} AND ${endDate}
            ORDER BY device_id, "createdAt" DESC;
        `;

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No data found for the given date"
            });
        }

        return res.status(200).json({
            success: true,
            data: result,
            count: result.length
        });

    } catch (error) {
        console.error("Error in POST /activeCount route:", {
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

module.exports = Robotcount;
