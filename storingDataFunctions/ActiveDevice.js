const axios = require("axios");
const prisma = require("../config/prismaConfig");
const redisClient = require("../config/redisConfig");

let active = [];
let activeRunningRobots = [];
let inactiveCount = 0;
let activeCountPercentage = 0;

async function devices() {
    console.log("=== Devices function called ===");
    // Reset global state
    active = [];
    
    try {
        console.log("Making API call to http://localhost:5002/api/devices");
        const result = await axios.get(`http://localhost:5002/api/devices`);
        console.log("API response received, status:", result.status);
        console.log("API response data structure:", {
            hasData: !!result.data,
            hasResult: !!result.data?.result,
            resultType: typeof result.data?.result,
            resultLength: result.data?.result?.length
        });
        
        // Validate response structure
        if (!result.data || !result.data.result) {
            console.error("Unexpected API response structure");
            console.error("Full response:", result.data);
            return;
        }
        
        const now = new Date();
        const thirtyMinutes = 30 * 60 * 1000;
        console.log("Current time:", now);
        console.log("Time threshold (30 minutes):", thirtyMinutes);

        console.log("Processing devices...");
        result.data.result.forEach((device, index) => {
            console.log(`Device ${index + 1}:`, {
                devEui: device.devEui,
                name: device.name,
                lastSeenAt: device.lastSeenAt,
                hasLastSeenAt: !!device.lastSeenAt
            });
            
            if (device.lastSeenAt) {
                const lastSeen = new Date(device.lastSeenAt);
                const timeDiff = now - lastSeen;
                console.log(`  Time since last seen: ${timeDiff}ms (${timeDiff / 1000 / 60} minutes)`);
                
                if (timeDiff < thirtyMinutes) {
                    active.push(device.devEui);
                    console.log(`  ✓ Device ${device.devEui} is ACTIVE`);
                } else {
                    console.log(`  ✗ Device ${device.devEui} is INACTIVE (last seen too long ago)`);
                }
            } else {
                console.log(`  ✗ Device ${device.devEui} has no lastSeenAt`);
            }
        });

        console.log("=== Devices function completed ===");
        console.log("Total devices processed:", result.data.result.length);
        console.log("Active devices:", active.length);
        console.log("Active device IDs:", active);
        
    } catch (error) {
        console.error("=== Error in devices function ===");
        console.error("Error message:", error.message);
        console.error("Error code:", error.code);
        console.error("Error response:", error.response?.data);
        console.error("Stack trace:", error.stack);
        throw error;
    }
}

async function getActiveRunningRobots() {
    console.log("=== getActiveRunningRobots function called ===");
    activeRunningRobots = [];
    
    console.log("Active devices to process:", active.length);
    
    if (active.length === 0) {
        console.log("No active devices to process");
        return;
    }
    
    try {
        for (let i = 0; i < active.length; i++) {
            const devEui = active[i];
            console.log(`Processing device ${i + 1}/${active.length}: ${devEui}`);
            
            try {
                // Get previous data from database
                console.log(`  Getting previous data for ${devEui}`);
                const prevOdd = await prisma.robot_data.findFirst({
                    where: { device_id: devEui },
                    orderBy: { id: "desc" },
                    take: 1,
                });
                console.log(`  Previous data:`, prevOdd ? { id: prevOdd.id, value: prevOdd.value } : "No previous data");

                // Get current data from API
                console.log(`  Getting current data for ${devEui}`);
                const apiUrl = `http://localhost:5002/devices/${devEui}/data`;
                console.log(`  API URL: ${apiUrl}`);
                
                const newOddRes = await axios.get(apiUrl);
                console.log(`  API response status: ${newOddRes.status}`);
                console.log(`  API response data:`, newOddRes.data);
                
                // Validate API response
                if (!newOddRes.data || typeof newOddRes.data.value === 'undefined') {
                    console.warn(`  ⚠️ No valid data for device ${devEui}`);
                    continue;
                }

                const newOdd = newOddRes.data.value;
                const prevOddValue = prevOdd?.value || 0;
                const newDiffOdd = newOdd - prevOddValue;
                
                console.log(`  Data comparison:`, {
                    newValue: newOdd,
                    prevValue: prevOddValue,
                    difference: newDiffOdd,
                    abs差别: Math.abs(newDiffOdd)
                });

                if (Math.abs(newDiffOdd) > 100) {
                    activeRunningRobots.push(devEui);
                    console.log(`  ✓ Device ${devEui} is RUNNING (difference: ${newDiffOdd})`);
                } else {
                    await redisClient.set(devEui, JSON.stringify(Math.abs(newDiffOdd)));
                    console.log(`  ✗ Device ${devEui} is IDLE (difference: ${newDiffOdd})`);
                }
                
            } catch (deviceError) {
                console.error(`  ❌ Error processing device ${devEui}:`, deviceError.message);
                if (deviceError.response) {
                    console.error(`  API Error Response:`, deviceError.response.status, deviceError.response.data);
                }
            }
        }
        
        console.log("=== getActiveRunningRobots function completed ===");
        console.log("Active running robots:", activeRunningRobots.length);
        console.log("Active running robot IDs:", activeRunningRobots);
        
    } catch (error) {
        console.error("=== Error in getActiveRunningRobots function ===");
        console.error("Error message:", error.message);
        console.error("Stack trace:", error.stack);
        throw error;
    }
}

function robotActivePercentage() {
    console.log("=== robotActivePercentage function called ===");
    console.log("Active devices:", active.length);
    console.log("Active running robots:", activeRunningRobots.length);
    
    inactiveCount = active.length - activeRunningRobots.length;
    activeCountPercentage = active.length > 0 ? (activeRunningRobots.length / active.length) * 100 : 0;
    
    console.log("Calculated values:", {
        inactiveCount,
        activeCountPercentage
    });
    console.log("=== robotActivePercentage function completed ===");
}

module.exports = {
    getActiveRunningRobots,
    devices,
    robotActivePercentage,
    active,
    inactiveCount,
    activeRunningRobots,
    activeCountPercentage
};