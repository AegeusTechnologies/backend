const prisma = require("../config/prismaConfig");
const { newData, odometerIfNotReset, odometerIfReset, ifOdomterIsSame } = require("../storingDataFunctions/newData");
require('dotenv').config(); 
const axios = require('axios');

const apiClient = axios.create({
    baseURL: process.env.API_URL,
    timeout: 5000,
    headers: {
        'Grpc-Metadata-Authorization': `Bearer ${process.env.API_TOKEN}`,
        'accept': 'application/json',
    }
});

async function storeDataToDatabase(data) {
    try {
        const objectvalues = data?.object

        const isAllValuesZero = Object.entries(objectvalues)
             .filter(([key,_]) => key !== 'CH0') 
             .every(([_, value]) => value === 0);

        if(isAllValuesZero){
            console.info("All channel values are zero, skipping data storage for device:",data.deviceInfo.deviceName);
            return { success: false, message: "All channel values are zero, skipping storage" };
        }

        const currentOdometer = parseInt(data.object.CH10);
        
        // Fetch device block info from API
        let blockDescription = "";
        try {
            const block = await apiClient.get(`/api/devices/${data.deviceInfo.devEui}`);
            blockDescription = String(block?.data?.device?.description ?? "Unknown Block");
           // console.log(`Fetched block description from ${block?.data?.device?.name}:`, blockDescription);
        } catch (error) {
            console.error("Error fetching device block data:", error.message);
            blockDescription = "Unknown Block";
        }

        // Fetch latest history from database
        const historyData = await prisma.robot_data.findFirst({
            where: { device_id: data.deviceInfo.devEui },
            orderBy: { createdAt: 'desc' },
            select: {
                panels_cleaned: true,
                raw_odometer_value: true,
            }
        });

        // No previous record — treat as new data
        if (!historyData) {
            console.info("New device data is being stored");
            return await newData(data, blockDescription);
        }
        

        const previousOdometer = historyData.raw_odometer_value; // previus odometer value of the device
       const previousPanelsCleaned = historyData.panels_cleaned; // previous panels cleaned value of the device
        //this is the case where odometerwill give some shit value
        // if (currentOdometer >previousOdometer * 20 ){
        //     console.info("Odometer value seems erroneous (too high), skipping storage",data.deviceInfo.deviceName);
        //     return { success: false, message: "Erroneous odometer value, skipping storage" };
        //  }

        // Compare odometer values and handle accordingly
        if (currentOdometer < previousOdometer ) {
            console.info("Odometer has been reset");
            return await odometerIfReset(data,previousOdometer,blockDescription);
        } else if (currentOdometer > previousOdometer) {
            console.info("Odometer has advanced");
            return await odometerIfNotReset(
                data,
                previousOdometer,
                blockDescription,
                previousPanelsCleaned
            );
        } else {
            return await ifOdomterIsSame(data,
                previousOdometer,
                blockDescription,
                previousPanelsCleaned)
        }

    } catch (error) {
        console.error("Error in storing data to database:", {
            message: error.message,
            stack: error.stack,
            deviceId: data?.deviceInfo?.devEui,
            timestamp: new Date().toISOString()
        });
        
        return { 
            success: false, 
            message: `Database storage failed: ${error.message}` 
        };
    }
}

module.exports = storeDataToDatabase;