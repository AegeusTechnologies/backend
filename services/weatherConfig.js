const weatherData = new Map()

async function storeWeatherData(data) {
    // Using timestamp as key for storing weather data
    const timestamp = Date.now()
    weatherData.set(timestamp, data)
}

async function getWeatherData() {
    try {
        // Get the latest entry by getting the last key
        const lastKey = Array.from(weatherData.keys()).pop()
        const response = weatherData.get(lastKey)

        if (!response) {
            return {
                success: false,
                message: "No weather data available"
            }
        }

        return {
            success: true,
            data: response,
            message: "Weather data fetched successfully"
        }
    } catch (error) {
        return {
            success: false,
            message: "Error fetching weather data",
            error: error.message
        }
    }
}

module.exports = { storeWeatherData, getWeatherData }