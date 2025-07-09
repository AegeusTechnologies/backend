import prisma from "../config/prismaConfig"
import { active, ActiveRunningRobot, InactiveCount, robotActivePercentage } from "../storingDataFunctions/ActiveDevice";

 async function availabilityData(){

    const today = new Date();

    try {
         const dataExit = await prisma.availability.findFirst({
            where:{
                createdAt:today
            }
         })
         if(dataExit){
            await prisma.availability.update({
                where:{
                    createdAt:today
                },
                data:{
                    totalRobot:active.length,
                    ActiveRunRobot:ActiveRunningRobot.length,
                    RobotActivePercentage:robotActivePercentage,
                    ActiveIdleRobot:InactiveCount
                }
            })
         }else{
            await prisma.availability.create({
                data:{
                    totalRobot:active.length,
                    ActiveRunRobot:ActiveRunningRobot.length,
                    RobotActivePercentage:robotActivePercentage,
                    ActiveIdleRobot:InactiveCount
                }
            })
         }
        
    } catch (error) {
        console.log("Availability error ",error.message)
    }

    

}

module.export={availabilityData}