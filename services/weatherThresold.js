const prisma = require("../config/prismaConfig")

async function  storeWeatherThresoldData(req,res){

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
        res.status(200).json({
            success:true,
            result:{
            message:"Weather Thresold Data Created Successfully",
            data:response
        }
        })
    } catch (error) {
        return res.status(500).json({
            success:false,
            message:"Error Creating Weather Thresold Data",
            error:error.message
        })
        
    }
}

async function getWeatherThresoldData(req,res){
    try {
        const response = await prisma.thresoldWeatherData.findUnique({
            where:{
                id:1
            },
            select:{
                windSpeed:true,
                temperature:true,
                humidity:true,
                rain_gauge:true,
                windDirection:true
            }
        })
        res.status(200).json({
            success:true,
            result:{
                message:"Weather Thresold Data Fetched Successfully",
                data:response
            }
        })
    } catch (error) {
        return {
            message:"Error Fetching Weather Thresold Data",
            error:error.message
        }
        
    }
}


async function updateThresoldWeatherData(req,res){
    try {
        const response = await prisma.thresoldWeatherData.update({
            where:{
                id:1
            },
            data:{
                ...req.body
            }
        })

       res.status(200).json({
            success:true,
            result:{
                message:"Weather Thresold Data Updated Successfully",
                data:response
            }
        })
    } catch (error) {
        return {
            message:"Error Updating Weather Thresold Data",
            error:error.message
        }
        
    }
}

module.exports={
    storeWeatherThresoldData,
    updateThresoldWeatherData,
    getWeatherThresoldData
}

