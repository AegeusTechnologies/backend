const express = require('express');
const { getErrorData } = require('../services/errorData');
const robotError = express.Router();

robotError.get('/robot-error',getErrorData)

module.exports = robotError;