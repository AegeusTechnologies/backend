const RobotsBattery = new Map();

setInterval(() =>{
    RobotsBattery.clear();
},100 * 60 * 1000); 

async function robotBattery(devEui ,battery_percent) {

    try{
     if (!devEui) {
            throw new Error("Device EUI and battery percent are required");
        }
        RobotsBattery.set(devEui, battery_percent);
        
    } catch (error) {
        console.error("Error in robotBattery:", {
            message: error.message,
            stack: error.stack,
            devEui,
            battery_percent
        });
        throw error;
        
    }
    
}

async function getRobotBattery(req,res) {

    const {devEui}= req.params;
    try {

        if(!devEui){
            return res.status(400).json({ error: "Device EUI is required" });
        }

        const batteryPercent = RobotsBattery.get(devEui);
        res.status(200).json({
            success: true,
            devEui: devEui,
            batteryPercent: batteryPercent || "No data available"
        });


        
    } catch (error) {
        console.error("Error in getRobotBattery:", {
            message: error.message,
            stack: error.stack,
            devEui
        });
        throw error;
        
    }
}



module.exports= {
    robotBattery,
    getRobotBattery,
    RobotsBattery
}