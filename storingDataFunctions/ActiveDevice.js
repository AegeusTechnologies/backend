const axios = require("axios");
const prisma = require("../config/prismaConfig");
const redisClient = require("../config/redisConfig");
let active = [];
let ActiveRunningRobot=[];
let InactiveCount = 0;
let activeCountPercentage = 0


async function devices() {
  try {
    const result = await axios.get(`http://localhost:5002/api/devices`);
    const now = new Date();
    const fifteen = 30 * 60 * 1000;

    result.data.result.forEach((device) => {
      if (device.lastSeenAt) {
        const lastSeen = new Date(device.lastSeenAt);
        if (now - lastSeen < fifteen) {
          active.push(device.devEui);
        }
      }
    });

    console.log(active);
  } catch (e) {
    console.error("Error fetching devices:", e.message);
  }
}


async function ActiveRunningRobot(){
    try {
        active.forEach(async(devEui)=>{
            const prevOdd= await prisma.robot_data.findUnique({
                where:{
                    device_id:devEui
                },
                orderBy:{
                    id:"desc"
                },
                take:1,
            })
        const newOdd = await axios.get(`http://localhost:5002/devices/${devEui}/data`);
        const newDiffOdd = newOdd-prevOdd;
        if(newDiffOdd > 100 || newDiffOdd <-100){
            ActiveRunningRobot.push(devEui)
        }else{
            await redisClient.set(devEui,JSON.stringify(Math.abs(newDiffOdd)));
            console.log("robot has not runned")
        }
        
        })
    } catch (error) {
        console.log("Error in ActiveRunningRobot:", error.message);
        
    }
}

async function robotActivePercentage(){
    try {
         InactiveCount =  (active.length - ActiveRunningRobot.length );
         activeCountPercentage= (InactiveCount / active.length)/100;

    } catch (error) {
        console.log("Error in robotActivePercentage:", error.message);
    }
}





module.exports={ActiveRunningRobot,devices,robotActivePercentage,active,InactiveCount};