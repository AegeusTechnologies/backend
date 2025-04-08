const express = require('express');
const { storeWeatherThresoldData, updateThresoldWeatherData, getWeatherThresoldData } = require('../services/weatherThresold');
const thresoldRouter = express.Router();


thresoldRouter.post('/weather-thresold', storeWeatherThresoldData);
thresoldRouter.put('/weather-thresold', updateThresoldWeatherData);
thresoldRouter.get('/weather-thresold',getWeatherThresoldData)


module.exports= thresoldRouter;
