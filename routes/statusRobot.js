const express = require('express');
const { status } = require('../mqttConnection/statusRobotRedis');
const statusRouter = express.Router();

statusRouter.get('/status/:devEui', async (req, res) => {
    const key = `status:${req.params.devEui}`;
    
    try {
        const data = status.get(key);
        if (data !== undefined) {
            res.json({ status: data });
        } else {
            res.status(404).json({ message: "Status not found" });
        }
    } catch (err) {
        res.status(500).json({ message: "Error fetching status", error: err.message });
    }
});

module.exports = statusRouter;
