
const { default: axios } = require("axios");
const express = require('express');
const deviceRouter = express.Router();
require('dotenv').config(); 

// Create axios instance with base URL and headers
const apiClient = axios.create({
    baseURL: process.env.API_URL,  // Make sure this is defined in your .env file
    timeout: 5000,
    headers: {
        'Grpc-Metadata-Authorization': `Bearer ${process.env.API_TOKEN}`,
        'accept': 'application/json',
    }
});

async function getAllMulticastGroup() {
    try {
        const response = await apiClient.get('/api/multicast-groups', {
            params: {
                limit: 100,
                applicationId: process.env.APPLICATION_ID
            }
        });
        return response.data.result;
    } catch (error) {
        console.error("Error fetching multicast groups:", error);
        return [];
    }
}

async function getDevicesOfMulticastGroup(groupId) {
    try {
        const response = await apiClient.get('/api/devices', {
            params: {
                limit: 1000,
                applicationId: process.env.APPLICATION_ID,
                multicastGroupId: groupId
            }
        });
        return response.data.result || [];
    } catch (error) {
        console.error("Error fetching devices for group:", error);
        return [];
    }
}


deviceRouter.get("/groupDevices", async (req, res) => {
    try {
        const groups = await getAllMulticastGroup();
        const groupsWithDevices = await Promise.all(groups.map(async group => {
            const devices = await getDevicesOfMulticastGroup(group.id);
            return {
                groupInfo: group,
                devices: devices,
                deviceCount: devices.length
            };
        }));

        res.status(200).json({
            success: true,
            data: groupsWithDevices
        });
    } catch (error) {
        console.error("Error processing group devices:", error);
        res.status(500).json({
            success: false,
            error: "Internal server error"
        });
    }
});

module.exports = deviceRouter;
