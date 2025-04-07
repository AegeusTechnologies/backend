const express = require('express');
const { triggermulticastGroup, getMissingDevices, Scheduler, getScheduledTasks, cancelScheduledTask } = require('../services/triggerMulticastGroup');

const TriggerAll =express.Router();

TriggerAll.post('/triggerAll', triggermulticastGroup);
TriggerAll.get("/getAllDevices", getMissingDevices);
TriggerAll.post('/schedule-task',Scheduler)
TriggerAll.get('/scheduled-tasks',getScheduledTasks)
TriggerAll.delete('/cancel-task/:taskId',cancelScheduledTask)


module.exports = TriggerAll;