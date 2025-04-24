const express = require('express');
const { getAllMessage, getMessageCount, clearMessageHistory } = require('../mqttConnection/mqttEvents');
const event = express.Router();

event.get('/events', async (req, res) => {
    try {
        const messages = await getAllMessage();
        res.status(200).json(messages);
    } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).json({ error: "Failed to fetch messages" });
    }
});

event.get('/events/count', async (req, res) => {
    try {
        const count = await getMessageCount();
        res.status(200).json({ count });
    } catch (error) {
        console.error("Error fetching message count:", error);
        res.status(500).json({ error: "Failed to fetch message count" });
    }
});

event.get('/events/clear', async (req, res) => {
    try {
        await clearMessageHistory();
        res.status(200).json({ message: 'Message history cleared' });
    } catch (error) {
        console.error("Error clearing message history:", error);
        res.status(500).json({ error: "Failed to clear message history" });
    }
});

module.exports = event;