const express = require('express');
const { getRobotBattery } = require('../services/robotBattery');
const BatteryRouter = express.Router();


BatteryRouter.get('/robot-battery/:devEui',getRobotBattery);


module.exports = BatteryRouter;