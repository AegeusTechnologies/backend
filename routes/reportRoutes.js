const express = require('express');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const router = express.Router();
const pgPool = new Pool({
    host: process.env.PG_HOST,
    port: parseInt(process.env.PG_PORT, 10),
    database: process.env.PG_DATABASE,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD?.toString(),
});
const DOWNLOADS_DIR = path.join(__dirname, '../downloads');
fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

async function generateReport(reportType) {
    const periodMap = {
        'daily': {
            trunc: 'day',
            interval: '1 day',
            startColumn: 'day'
        },
        'monthly': {
            trunc: 'month',
            interval: '1 month',
            startColumn: 'month_start'
        },
        'yearly': {
            trunc: 'year',
            interval: '1 year',
            startColumn: 'year_start'
        }
    };

    const period = periodMap[reportType];

    try {
        // Individual Devices Query with cumulative totals
    // Update the individualDevicesQuery inside generateReport function:
// Inside generateReport function, modify the individualDevicesQuery:
const individualDevicesQuery = `
WITH period_data AS (
    SELECT 
        device_id,
        device_name,
        SUM(panels_cleaned) AS total_panels_cleaned,
        MAX(cumulative_panels_cleaned) AS lifetime_total_cleaned,
        AVG(battery_discharge_cycle) AS avg_battery_discharge,
        DATE_TRUNC('${period.trunc}', timestamp) AS ${period.startColumn}
    FROM 
        Robot_clp_data
    WHERE 
        CASE 
            WHEN '${reportType}' = 'daily' THEN
                timestamp >= CURRENT_DATE AND timestamp < CURRENT_DATE + INTERVAL '1 day'
            WHEN '${reportType}' = 'monthly' THEN
                timestamp >= DATE_TRUNC('month', CURRENT_DATE) 
                AND timestamp < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
            WHEN '${reportType}' = 'yearly' THEN
                timestamp >= DATE_TRUNC('year', CURRENT_DATE)
                AND timestamp < DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year'
        END
    GROUP BY 
        device_id, device_name, ${period.startColumn}
)
SELECT 
    device_id,
    device_name,
    total_panels_cleaned,
    lifetime_total_cleaned,
    ROUND(avg_battery_discharge::numeric, 2) AS avg_battery_discharge,
    TO_CHAR(${period.startColumn}, 'YYYY-MM-DD HH24:MI:SS') as ${period.startColumn}
FROM 
    period_data 
ORDER BY 
    device_name;
`;

// Also update the overallSummaryQuery with the same conditions:
const overallSummaryQuery = `
WITH period_data AS (
    SELECT 
        device_id,
        device_name,
        SUM(panels_cleaned) AS total_panels_cleaned,
        MAX(cumulative_panels_cleaned) AS lifetime_total_cleaned,
        AVG(battery_discharge_cycle) AS avg_battery_discharge,
        DATE_TRUNC('${period.trunc}', timestamp) AS ${period.startColumn}
    FROM 
        Robot_clp_data
    WHERE 
        CASE 
            WHEN '${reportType}' = 'daily' THEN
                timestamp >= CURRENT_DATE AND timestamp < CURRENT_DATE + INTERVAL '1 day'
            WHEN '${reportType}' = 'monthly' THEN
                timestamp >= DATE_TRUNC('month', CURRENT_DATE) 
                AND timestamp < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
            WHEN '${reportType}' = 'yearly' THEN
                timestamp >= DATE_TRUNC('year', CURRENT_DATE)
                AND timestamp < DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year'
        END
    GROUP BY 
        device_id, device_name, ${period.startColumn}
)
SELECT 
    COUNT(DISTINCT device_id) AS total_robots,
    SUM(total_panels_cleaned) AS overall_total_panels_cleaned,
    SUM(lifetime_total_cleaned) AS overall_lifetime_total_cleaned,
    ROUND(AVG(avg_battery_discharge)::numeric, 2) AS overall_avg_battery_discharge
FROM 
    period_data;
`;
        const [individualDevicesResult, overallSummaryResult] = await Promise.all([
            pgPool.query(individualDevicesQuery),
            pgPool.query(overallSummaryQuery)
        ]);

        const csvPath = path.join(DOWNLOADS_DIR, `${reportType}_report.csv`);
        const csvWriter = createCsvWriter({
            path: csvPath,
            header: [
                {id: 'device_name', title: 'Device Name'}, 
                {id: 'total_panels_cleaned', title: 'Total Panels Cleaned'},
                {id: 'lifetime_total_cleaned', title: 'Lifetime Total Cleaned'},
                {id: 'avg_battery_discharge', title: 'Avg Battery Discharge'},
                {id: `${period.startColumn}`, title: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Start`}
            ]
        });

        await csvWriter.writeRecords(individualDevicesResult.rows);

        return {
            individualDevices: individualDevicesResult.rows,
            overallSummary: overallSummaryResult.rows[0],
            downloadPath: `/downloads/${reportType}_report.csv`
        };

    } catch (error) {
        console.error(`Error generating ${reportType} report:`, error);
        throw error;
    }
}

// Report Routes
router.get('/daily-report', async (req, res) => {
    try {
        const reportData = await generateReport('daily');
        res.json(reportData);
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate daily report' });
    }
});

router.get('/monthly-report', async (req, res) => {
    try {
        const reportData = await generateReport('monthly');
        res.json(reportData);
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate monthly report' });
    }
});

router.get('/yearly-report', async (req, res) => {
    try {
        const reportData = await generateReport('yearly');
        res.json(reportData);
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate yearly report' });
    }
});

router.get('/robot-performance/last-7-days', async (req, res) => {
    try {
        const query = `
            WITH daily_performance AS (
                SELECT 
                    DATE_TRUNC('day', timestamp) AS performance_date,
                    SUM(panels_cleaned) AS total_panels_cleaned,
                    MAX(cumulative_panels_cleaned) AS cumulative_total,
                    AVG(battery_discharge_cycle) AS avg_battery_discharge
                FROM 
                    Robot_clp_data
                WHERE 
                    timestamp >= CURRENT_DATE - INTERVAL '7 days'
                GROUP BY 
                    performance_date
                ORDER BY 
                    performance_date
            )
            SELECT 
                TO_CHAR(performance_date, 'YYYY-MM-DD') AS date,
                total_panels_cleaned,
                cumulative_total,
                ROUND(avg_battery_discharge::numeric, 2) AS avg_battery_discharge
            FROM 
                daily_performance
            ORDER BY 
                performance_date;
        `;

        const result = await pgPool.query(query);
        const chartData = result.rows.map(row => ({
            date: row.date,
            total_panels_cleaned: parseInt(row.total_panels_cleaned) || 0,
            cumulative_total: parseInt(row.cumulative_total) || 0,
            avg_battery_discharge: parseFloat(row.avg_battery_discharge) || 0
        }));

        res.json(chartData);
    } catch (error) {
        console.error('Error fetching robot performance:', error);
        res.status(500).json({ 
            error: 'Failed to retrieve performance data',
            details: error.message 
        });
    }
});

// Download Routes remain the same but update the valid types
router.get('/download-report/:type', (req, res) => {
    const reportType = req.params.type;
    const validTypes = ['daily', 'monthly', 'yearly'];

    if (!validTypes.includes(reportType)) {
        return res.status(400).send('Invalid report type');
    }

    const csvPath = path.join(DOWNLOADS_DIR, `${reportType}_report.csv`);
    
    if (fs.existsSync(csvPath)) {
        res.download(csvPath, `${reportType}_report.csv`, (err) => {
            if (err) {
                console.error('Download error:', err);
                res.status(500).send('Could not download the file');
            }
        });
    } else {
        console.error('File not found:', csvPath);
        res.status(404).send('Report file not found');
    }
});

module.exports = router;