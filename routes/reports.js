const express = require('express');
const prisma = require('../config/prismaConfig');

const Reportrouter = express.Router();

Reportrouter.post('/robot-cleaning-report',async (req,res)=>{
    try {
        const {startDate,endDate} = req.body;

        const start = new Date(startDate);
        const end = new Date(endDate);

if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({
        success: false,
        message: 'Invalid date format. Please use YYYY-MM-DD format'
    });
}

if (end < start) {
    return res.status(400).json({
        success: false,
        message: 'endDate cannot be earlier than startDate'
    });
}

        const robotReports = await  prisma.robot_data.groupBy({
            by:['device_id','device_name'],
            _sum:{
                panels_cleaned:true
            },
            where:{
                createdAt:{
                    gte:new Date(startDate),
                    lte:new Date(endDate)
                }
            },
    
        })

        const processedReports= robotReports.map(robot =>({
            robotId:robot.device_id,
            robotName:robot.device_name,
            totalPanelsCleaned:robot._sum.panels_cleaned || 0

        }));

        const totalPanelsCleaned= processedReports.reduce(
            (sum,robot)=>sum+robot.totalPanelsCleaned,0);

            const finalReport = processedReports.map(robot => ({
                ...robot,
                contributionPercentage: totalPanelsCleaned > 0 ? ((robot.totalPanelsCleaned / totalPanelsCleaned) * 100).toFixed(2) + '%': '0%'
            }));

            res.json({
                success: true,
                dateRange: {
                    from: startDate,
                    to: endDate
                },
                totalPanelsCleaned,
                robots: finalReport
            });


    } catch (error) {
        console.error('Error generating robot cleaning report:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating robot cleaning report',
            error: error.message
        });
        
    }
})

Reportrouter.post('/robot-battery-report/weekly', async (req, res) => {
    try {
        const robotReports = await prisma.$queryRaw`
            SELECT 
                DATE_TRUNC('day', "createdAt") as date,
                AVG(battery_discharge_cycle) as avg_discharge,
                COUNT(DISTINCT  device_id ) as robot_count
            FROM "Robot_data"
            WHERE "createdAt" >= NOW() - INTERVAL '7 days'
            GROUP BY DATE_TRUNC('day', "createdAt")
            ORDER BY date ASC
        `;
        
        const categories = [];
        const batteryData = [];
        const robotCounts = [];
        
        robotReports.forEach(report => {
            const date = new Date(report.date);
            categories.push(date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric'
            }));
            const avgDischarge = Number(report.avg_discharge || 0).toFixed(2);
            batteryData.push(Number(avgDischarge));
            robotCounts.push(report.robot_count);
        });
        
        res.json({
            success: true,
            chartData: {
                chart: {
                    type: 'line'
                },
                title: {
                    text: 'Day-wise Average Battery Discharge Cycles',
                    align: 'left'
                },
                xAxis: {
                    categories: categories,
                    title: {
                        text: 'Date'
                    }
                },
                yAxis: {
                    min: 0,
                    max: 100,
                    title: {
                        text: 'Battery Discharge (%)'
                    }
                },
                tooltip: {
                    formatter: function() {
                        const index = this.point.index;
                        return `<b>${this.x}</b><br/>
                               Battery Discharge: ${this.y}%<br/>
                               Based on ${robotCounts[index]} robots`;
                    }
                },
                plotOptions: {
                    line: {
                        marker: {
                            enabled: true
                        },
                        lineWidth: 2,
                        color: '#4575b4'
                    }
                },
                series: [{
                    name: 'Battery Discharge',
                    data: batteryData
                }]
            }
        });
    } catch (error) {
        console.error('Error generating weekly battery discharge report:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating weekly battery discharge report',
            error: error.message
        });
    }
});

Reportrouter.post('/robot-panels-report/weekly', async (req, res) => {
    try {
        // Query for the past 7 days of robot data with daily TOTAL panels cleaned across all robots
        // Note the SUM instead of AVG and the properly quoted table name
        const robotReports = await prisma.$queryRaw`
            SELECT 
                DATE_TRUNC('day', "createdAt") as date,
                SUM(panels_cleaned) as total_panels,
                COUNT(DISTINCT device_id) as robot_count
            FROM "Robot_data"
            WHERE "createdAt" >= NOW() - INTERVAL '7 days'
            GROUP BY DATE_TRUNC('day', "createdAt")
            ORDER BY date ASC
        `;
        
        // Format data for the chart
        const categories = [];
        const panelsData = [];
        const robotCounts = [];
        
        robotReports.forEach(report => {
            const date = new Date(report.date);
            categories.push(date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric'
            }));
            
            // Round total panels to whole numbers
            const totalPanels = Math.round(Number(report.total_panels || 0));
            panelsData.push(totalPanels);
            
            // Store robot count for tooltip
            robotCounts.push(report.robot_count);
        });
        
        res.json({
            success: true,
            chartData: {
            chart: {
            type: 'column'
            },
            title: {
            text: 'Day Wise Total Panels Cleaned Daily ',
            align: 'left'
            },
            xAxis: {
            categories: categories,
            title: {
            text: 'Date'
            }
            },
            yAxis: {
            min: 0,
            title: {
            text: 'Panels Cleaned'
            }
            },
            tooltip: {
            formatter: function() {
            const index = this.point.index;
            return `<b>${this.x}</b><br/>
               Total Panels Cleaned<br/>
               By ${robotCounts[index]} robots`;
            }
            },
            plotOptions: {
            column: {
            colorByPoint: true,
            colors: ['#1a237e', '#283593', '#303f9f', '#3949ab', 
            '#3f51b5', '#5c6bc0', '#7986cb']
            }
            },
            series: [{
            name: 'Panels Cleaned',
            data: panelsData
            }]
            }
        });
    } catch (error) {
        console.error('Error generating weekly panels cleaned report:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating weekly panels cleaned report',
            error: error.message
        });
    }
});

module.exports = Reportrouter;