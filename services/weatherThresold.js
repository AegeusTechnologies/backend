const prisma = require("../config/prismaConfig")

async function storeWeatherThresoldData(req, res) {
    try {
        const response = await prisma.thresoldWeatherData.create({
            data: {
                rain_gauge: 0.4,
                wind_speed: 1.7,
                wind_speed_level: 2,
                wind_direction: "S",
                wind_direction_angle: 185.7
            }
        });
        res.status(200).json({
            success: true,
            result: {
                message: "Weather Data Created Successfully",
                data: response
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error Creating Weather Data",
            error: error.message
        });
    }
}

async function getWeatherThresoldData(req, res) {
    try {
        const response = await prisma.thresoldWeatherData.findUnique({
            where: {
                id: 1
            },
            select: {
                rain_gauge: true,
                wind_speed: true,
                wind_speed_level: true,
                wind_direction: true,
                wind_direction_angle: true
            }
        });
        res.status(200).json({
            success: true,
            result: {
                message: "Weather Data Fetched Successfully",
                data: response
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error Fetching Weather Data",
            error: error.message
        });
    }
}

async function  updateThresoldWeatherData(req, res) {
    
    if(!req.body){
        return res.status(400).json({
            success: false,
            message: "Request body is required"
        });
    }  
    const {
  rain_gauge,
  wind_speed,
  wind_speed_level,
  wind_direction,
  wind_direction_angle,
} = req.body;

// Convert values if necessary
const parsedData = {
  rain_gauge: parseFloat(rain_gauge),
  wind_speed: parseFloat(wind_speed),
  wind_speed_level: parseInt(wind_speed_level),
  wind_direction: wind_direction,
  wind_direction_angle: parseFloat(wind_direction_angle),
};

    
    try {
        const response = await prisma.thresoldWeatherData.update({
            where: {
                id: 1
            },
            data: {
                rain_gauge: parsedData.rain_gauge,
                wind_speed: parsedData.wind_speed,
                wind_speed_level: parsedData.wind_speed_level,
                wind_direction: parsedData.wind_direction,
                wind_direction_angle: parsedData.wind_direction_angle
            }
        });

        res.status(200).json({
            success: true,
            result: {
                message: "Weather Data Updated Successfully",
                data: response
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error Updating Weather Data",
            error: error.message
        });
    }
}

module.exports = {
    storeWeatherThresoldData,
    updateThresoldWeatherData,
    getWeatherThresoldData
}
