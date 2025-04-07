const express = require('express');
const { storeWeatherThresoldData } = require('../services/weatherThresold');
const thresoldRouter = express.Router();


thresoldRouter.post('/weather-thresold', storeWeatherThresoldData);
thresoldRouter.put('/weather-thresold', storeWeatherThresoldData);


module.exports= thresoldRouter;
