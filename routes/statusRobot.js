const express = require('express');
const redisClient = require('../config/redisConfig');
const statusRouter = express.Router();

statusRouter.get('/status/:devEui', async (req, res) => {
    const key = `status:${req.params.devEui}`;
    try {
        const data = await redisClient.get(key);
        if (data) {
            // Handle both JSON and non-JSON data
            try {
                res.json(JSON.parse(data));
            } catch {
                // If data is not JSON, send it as a plain string
                res.json({ status: data });
            }
        } else {
            res.status(404).json({ message: "Status not found" });
        }
    } catch (err) {
        res.status(500).json({ message: "Error fetching status", error: err.message });
    }
});

module.exports = statusRouter;