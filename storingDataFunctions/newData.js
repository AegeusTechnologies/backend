const prisma = require("../config/prismaConfig");

async function newData(data) {
    try {
       
        const solarPanelCleaned = parseFloat(data.object.CH10) * 
            (Number(process.env.MULTIPLICATION_FACTOR) - Number(process.env.PANNELS_GAP));

        // Validate calculated value
        if (solarPanelCleaned < 0) {
            console.info("no panel is cleaned")
            return
        }

        const result = await prisma.robot_data.create({
            data: {
                device_id: data.deviceInfo.devEui,
                device_name: data.deviceInfo.deviceName,
                panels_cleaned: solarPanelCleaned,
                raw_odometer_value: data.object.CH10,
                battery_discharge_cycle: data.object.CH6,
                //created: new Date() // Add timestamp
            }
        });

        return {
            success: true,
            message: "Data stored successfully",
            data: result
        };
    } catch (error) {
        console.error("Error in storing data to database:", {
            message: error.message,
            stack: error.stack,
            data: JSON.stringify(data)
        });
        throw error; // Rethrow to handle at higher level
    }
}

async function odometerIfReset(data, previousOdometerValue, previousPannelsCleaned) {
    try {
        const totalOdometerValue = data.object.CH10 + previousOdometerValue;
        const solarPanelCleaned = (totalOdometerValue * 
            (Number(process.env.MULTIPLICATION_FACTOR) - Number(process.env.PANNELS_GAP))) - 
            previousPannelsCleaned;

        if (solarPanelCleaned <= 0) {
            throw new Error("Calculated panels cleaned value is not valid");
        }

        const result = await prisma.robot_data.create({
            data: {
                device_id: data.deviceInfo.devEui,
                device_name: data.deviceInfo.deviceName,
                panels_cleaned: solarPanelCleaned,
                raw_odometer_value: totalOdometerValue,
                battery_discharge_cycle: data.object.CH6
                // Add created field if needed
            }
        });

        return {
            success: true,
            message: "Data stored after odometer reset",
            data: result
        };
    } catch (error) {
        console.error("Error in odometerIfReset:", {
            message: error.message,
            stack: error.stack
        });
        throw error;
    }
}
async function odometerIfNotReset(data, previousPannelsCleaned){
    try {
        const solarPanelCleaned = (Number(data.object.CH10) * (parseFloat(process.env.MULTIPLICATION_FACTOR) - parseFloat(process.env.PANNELS_GAP))) - previousPannelsCleaned;
        if(solarPanelCleaned <= 0){
            throw new Error("No new panels cleaned data")
        }
          
        const result = await prisma.robot_data.create({  
            data:{
                device_id: data.deviceInfo.devEui,
                device_name: data.deviceInfo.deviceName,
                panels_cleaned: solarPanelCleaned,
                raw_odometer_value:(data.object.CH10),  
                battery_discharge_cycle: data.object.CH6
            }
        });
        
        return {  // FIXED: Added return statement
            success: true,
            message: "Data stored - odometer advanced",
            data: result
        };
    } catch (error) {
        throw error;
    }
}


module.exports={ newData, odometerIfReset , odometerIfNotReset }


