const prisma = require("../config/prismaConfig")
const express = require('express')
const redisClient = require("../config/redisConfig")
const { RobotsBattery } = require("../services/robotBattery")
const allReportRouter = express.Router()

allReportRouter.post('/report/day', async (req, res) => {
    try {
        // Get start of today
        const today = new Date()
        today.setHours(5, 30, 0, 0)  
        
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        const DailyReport = await prisma.robot_data.groupBy({
            by: ['device_id', 'device_name'],
            _sum: {
                panels_cleaned: true,
                battery_discharge_cycle: true
            },
            where: {
                createdAt: {
                    gte: today,
                    lt: tomorrow
                }
            }
        })
        const processedReports = await Promise.all(DailyReport.map(async (robot) => {
            const block = await prisma.robot_data.findFirst({
                where: {
                    device_id: robot.device_id
                },
                select: {
                    block: true
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });

            //const battery = await redisClient.get(robot.device_id)
           // console.log("Battery data from Redis this is to get the data from the redif  isso usefull:", battery);
            const  actualBattery = RobotsBattery.get(robot.device_id);
            console.log("bateryt data from the redis:", actualBattery);
            // If battery data is not found, default to 0
           // const batteryvoltage = battery ? JSON.parse(battery).object.CH5 : 0;
            return {
                robotId: robot.device_id,
                block: block.block,
                battery:actualBattery || 0,
                robotName: robot.device_name,
                totalPanelsCleaned: robot._sum.panels_cleaned || 0,
            };
        }));
        

        const totalPanelsCleaned = processedReports.reduce((sum, robot) => 
            sum + robot.totalPanelsCleaned, 0)

        const finalReport = processedReports.map(robot => ({
            ...robot,
            contributionPercentage: totalPanelsCleaned > 0 
                ? ((robot.totalPanelsCleaned / totalPanelsCleaned) * 100).toFixed(2) + "%" 
                : "0%"
        }))
        // Sort robots by name
        finalReport.sort((a, b) => a.robotName.localeCompare(b.robotName));


        res.json({
            success: true,
            date: today.toISOString().split('T')[0],
            totalPanelsCleaned,
            robots: finalReport
        })

    } catch (error) {
        console.error('Error generating robot cleaning report:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating robot cleaning report',
            error: error.message
        })
    }
})


allReportRouter.post('/report/monthly', async (req, res) => {
    try {
        // Get first day of current month
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(5, 30, 0, 0)  // Set to 5:30 AM UTC (11:00 AM IST)

        // Get first day of next month
        const endOfMonth = new Date(startOfMonth)
        endOfMonth.setMonth(endOfMonth.getMonth() + 1)

        const monthlyReport = await prisma.robot_data.groupBy({
            by: ['device_id', 'device_name'],
            _sum: {
                panels_cleaned: true,
                battery_discharge_cycle: true
            },
            where: {
                createdAt: {
                    gte: startOfMonth,
                    lt: endOfMonth
                }
            }
        })

        const processedReports = await Promise.all(monthlyReport.map(async (robot) => {
            const block = await prisma.robot_data.findFirst({
                where: {
                    device_id: robot.device_id
                },
                select: {
                    block: true
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });

            return {
                robotId: robot.device_id,
                block: block.block,
                robotName: robot.device_name,
                totalPanelsCleaned: robot._sum.panels_cleaned || 0,
            };
        }));

        const totalPanelsCleaned = processedReports.reduce((sum, robot) => 
            sum + robot.totalPanelsCleaned, 0)

        const finalReport = processedReports.map(robot => ({
            ...robot,
            contributionPercentage: totalPanelsCleaned > 0 
                ? ((robot.totalPanelsCleaned / totalPanelsCleaned) * 100).toFixed(2) + "%" 
                : "0%"
        }))

        finalReport.sort((a, b) => a.robotName.localeCompare(b.robotName));

        res.json({
            success: true,
            month: startOfMonth.toISOString().split('T')[0],
            totalPanelsCleaned,
            robots: finalReport
        })

    } catch (error) {
        console.error('Error generating robot cleaning report:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating robot cleaning report',
            error: error.message
        })
    }
})

allReportRouter.post('/report/monthly-daily', async (req, res) => {
    try {
        const { month } = req.body; // Expecting format: '2025-08'
        if (!month) {
            return res.status(400).json({ success: false, message: 'Month is required in YYYY-MM format' });
        }

        const [year, monthIndex] = month.split('-').map(Number);
        const startOfMonth = new Date(Date.UTC(year, monthIndex - 1, 1, 5, 30)); // IST 11:00 AM
        const endOfMonth = new Date(Date.UTC(year, monthIndex, 1, 5, 30)); // Next month start

        // const dailyReport = await prisma.robot_data.groupBy({
        //     by: ['device_id', 'device_name'],
        //     _sum: {
        //         panels_cleaned: true
        //     },
        //     where: {
        //         createdAt: {
        //             gte: startOfMonth,
        //             lt: endOfMonth
        //         }
        //     },
        //     orderBy: {
        //         device_name: 'asc'
        //     }
        // });

        // Fetch all records grouped by date
        const rawData = await prisma.robot_data.findMany({
            where: {
                createdAt: {
                    gte: startOfMonth,
                    lt: endOfMonth
                }
            },
            select: {
                device_id: true,
                device_name: true,
                panels_cleaned: true,
                createdAt: true
            }
        });

        // Process into daily summary
        const robotMap = {};

        rawData.forEach(record => {
            const date = record.createdAt.toISOString().split('T')[0]; // Get YYYY-MM-DD
            const robotId = record.device_id;
            const robotName = record.device_name;

            if (!robotMap[robotId]) {
                robotMap[robotId] = {
                    robotId,
                    robotName,
                    dailyCleaning: {}
                };
            }

            robotMap[robotId].dailyCleaning[date] = 
                (robotMap[robotId].dailyCleaning[date] || 0) + (record.panels_cleaned || 0);
        });

        // Convert map to array and fill missing dates with 0
        const daysInMonth = new Date(year, monthIndex, 0).getDate(); // e.g., 31 for August
        const dateKeys = Array.from({ length: daysInMonth }, (_, i) => {
            const day = String(i + 1).padStart(2, '0');
            return `${month}-${day}`; // Format: '2025-08-01'
        });

        const finalReport = Object.values(robotMap).map(robot => {
            const filledDaily = {};
            dateKeys.forEach(date => {
                filledDaily[date] = robot.dailyCleaning[date] || 0;
            });
            return {
                ...robot,
                dailyCleaning: filledDaily
            };
        });

        res.json({
            success: true,
            month,
            days: dateKeys,
            robots: finalReport
        });

    } catch (error) {
        console.error('Error generating daily robot cleaning report:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating daily robot cleaning report',
            error: error.message
        });
    }
});


allReportRouter.post('/report/yearly', async (req, res) => {
    try {
        // Get first day of current year
        const startOfYear = new Date()
        startOfYear.setMonth(0, 1) // January 1st
        startOfYear.setHours(5, 30, 0, 0)  // Set to 5:30 AM UTC (11:00 AM IST)

        // Get first day of next year
        const endOfYear = new Date(startOfYear)
        endOfYear.setFullYear(endOfYear.getFullYear() + 1)

        const yearlyReport = await prisma.robot_data.groupBy({
            by: ['device_id', 'device_name'],
            _sum: {
                panels_cleaned: true,
                battery_discharge_cycle: true
            },
            where: {
                createdAt: {
                    gte: startOfYear,
                    lt: endOfYear
                }
            }
        })

        const processedReports = await Promise.all(yearlyReport.map(async (robot) => {
            const block = await prisma.robot_data.findFirst({
                where: {
                    device_id: robot.device_id
                },
                select: {
                    block: true
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });
            return {
                robotId: robot.device_id,
                block: block.block,
                robotName: robot.device_name,
                totalPanelsCleaned: robot._sum.panels_cleaned || 0,
            };
        }));

        const totalPanelsCleaned = processedReports.reduce((sum, robot) => 
            sum + robot.totalPanelsCleaned, 0)

        const finalReport = processedReports.map(robot => ({
            ...robot,
            contributionPercentage: totalPanelsCleaned > 0 
                ? ((robot.totalPanelsCleaned / totalPanelsCleaned) * 100).toFixed(2) + "%" 
                : "0%"
        }))

        // Sort robots by name
        finalReport.sort((a, b) => a.robotName.localeCompare(b.robotName));

        res.json({
            success: true,
            year: startOfYear.getFullYear().toString(),
            totalPanelsCleaned,
            robots: finalReport
        })

    } catch (error) {
        console.error('Error generating robot cleaning report:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating robot cleaning report',
            error: error.message
        })
    }
})




module.exports = allReportRouter