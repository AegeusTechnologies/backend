const prisma = require("../config/prismaConfig")
const express = require('express')
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