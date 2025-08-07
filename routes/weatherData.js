const express = require('express');
const { getWeatherData } = require('../services/weatherConfig');

const weatherRouter = express.Router();

weatherRouter.get('/weatherData', async (req, res) => {
    const result = await getWeatherData();
    res.status(result.success ? 200 : 500).json(result);
});

module.exports = { weatherRouter };
