const express = require('express');
const { getWeatherData } = require('../services/weatherConfig');

const weatherRouter = express.Router();


weatherRouter.get('/weatherData',getWeatherData)


module.exports = {weatherRouter}