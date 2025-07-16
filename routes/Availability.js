const express = require('express');
const { getAvailabilityData, getAvailabilityDataByDate, getAvailabilityDataByRange } = require('../services/AvailabilityData');

const availabilityRoutes = express.Router();

availabilityRoutes.get('/availability',getAvailabilityData);
availabilityRoutes.post('/availability/date',getAvailabilityDataByDate);
availabilityRoutes.post('/availability/range',getAvailabilityDataByRange);
    
    
module.exports = availabilityRoutes;