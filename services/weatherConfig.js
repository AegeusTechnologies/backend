const weatherData = new Map()

async function storeWeatherData(data){
weatherData.set(data)
}

async function getWeatherData(){
    try {
        const response= weatherData.get()

        if(!response){
            return{
                success:false,
                message:"No weather data available ",

            }
        }

        return {
            success:true,
            data:response,
            message:"Weather data fetched successfully"
        }


    } catch (error) {

        return{
            success:false,
            message:"Error fetching weather data",
            error:error.message
        }
        
    }
}


module.exports ={storeWeatherData,getWeatherData}