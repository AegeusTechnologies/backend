const prisma = require("../config/prismaConfig")

async function  storeWeatherThresoldData(){

    try {
        const {windSpeed,temperature,humidity,rain_gauge,windDirection}= req.body

        const response = await prisma.thresoldWeatherData.create({
            data:{
                windSpeed:windSpeed,
                temperature:temperature,
                humidity:humidity,
                rain_gauge:rain_gauge,
                windDirection:windDirection
            }
       
        })
        return  {
            message:"Weather Thresold Data Created Successfully",
            data:response
        }
    } catch (error) {
        return {
            message:"Error Creating Weather Thresold Data",
            error:error.message
        }
        
    }
}


async function updateThresoldWeatherData(){
    try {
        const response = await prisma.thresoldWeatherData.updateMany({
            where:{
                id:1
            },
            data:{
                ...req.body
            }
        })

        return {
            message:"Weather Thresold Data Updated Successfully",
            data:response
        }
    } catch (error) {
        return {
            message:"Error Updating Weather Thresold Data",
            error:error.message
        }
        
    }
}

module.exports={
    storeWeatherThresoldData,
    updateThresoldWeatherData
}

