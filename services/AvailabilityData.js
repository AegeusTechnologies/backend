const prisma = require("../config/prismaConfig");
const { 
    devices, 
    getActiveRunningRobots, 
    active, 
    activeRunningRobots, 
    inactiveCount, 
    robotActivePercentage
} = require("../storingDataFunctions/ActiveDevice");

async function availabilityData() {
    console.log("Availability data function called");
    try {
        // Execute functions in sequence and handle errors
        await devices();
        await getActiveRunningRobots();
        robotActivePercentage(); 
        
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        
        // Check if data already exists for today
        const dataExist = await prisma.availability.findFirst({
            where: {
                createdAt: {
                    gte: startOfDay,
                    lt: endOfDay
                }
            }
        });
        
        // Calculate availability data with safety checks
        const totalRobots = active.length;
        const activeRunRobots = activeRunningRobots.length;
       // const robotActivePercentage = robotActivePercentage
        const activeIdleRobots = inactiveCount;
        
        const availabilityData = {
            totalRobot: totalRobots,
            ActiveRunRobot: activeRunRobots,
            RobotActivePercentage: robotActivePercentage,
            ActiveIdleRobot: activeIdleRobots
        };
        
        console.log("Availability data to save:", availabilityData);
        
        if (dataExist) {
            await prisma.availability.update({
                where: {
                    id: dataExist.id 
                },
                data: availabilityData
            });
            console.log("Availability data updated successfully");
        } else {
            await prisma.availability.create({
                data: availabilityData
            });
            console.log("New availability data created successfully");
        }
        
    } catch (error) {
        console.error("Availability error:", error.message);
        console.error("Stack trace:", error.stack);
        throw error; 
    }
}

async function getAvailabilityData(req, res) {
    try {
        const today = new Date();
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        const lastTenDays = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 10);

        const availabilityData = await prisma.availability.findMany({
            where: {
                createdAt: {
                    gte: lastTenDays,
                    lt: endOfDay
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            select: {
                createdAt: true,
                totalRobot: true,
                ActiveRunRobot: true,
                ActiveIdleRobot: true,
                RobotActivePercentage: true
            }
        });

        res.json({
            status: "success",
            message: "Availability data fetched successfully",
            data: availabilityData
        });

    } catch (error) {
        console.error("Error fetching availability data:", error.message);
        res.status(500).json({
            status: "error",
            message: "Error while fetching the data",
            error: error.message
        });
    }
}

async function getAvailabilityDataByDate(req, res) {
    try {
        const { Date } = req.body;
        
        if (!Date) {
            return res.status(400).json({
                status: "error",
                message: "Date is required"
            });
        }

        const startDate = new Date(Date);
        const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
        
        const availabilityData = await prisma.availability.findMany({
            where: {
                createdAt: {
                    gte: startDate,
                    lt: endDate
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            select: {
                createdAt: true,
                totalRobot: true,
                ActiveRunRobot: true,
                ActiveIdleRobot: true,
                RobotActivePercentage: true
            }
        });

        res.json({
            status: "success",
            message: "Availability data fetched successfully",
            data: availabilityData
        });
        
    } catch (error) {
        console.error("Error fetching availability data by date:", error.message);
        res.status(500).json({
            status: "error",
            message: "Error while fetching the data",
            error: error.message
        });
    }
}

async function getAvailabilityDataByRange(req, res) {
    try {
        const { startDate, endDate } = req.body;
        
        if (!startDate || !endDate) {
            return res.status(400).json({
                status: "error",
                message: "Both startDate and endDate are required"
            });
        }

        const availabilityData = await prisma.availability.findMany({
            where: {
                createdAt: {
                    gte: new Date(startDate),
                    lt: new Date(endDate)
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            select: {
                createdAt: true,
                totalRobot: true,
                ActiveRunRobot: true,
                ActiveIdleRobot: true,
                RobotActivePercentage: true
            }
        });

        res.json({
            status: "success",
            message: "Availability data fetched successfully",
            data: availabilityData
        });
        
    } catch (error) {
        console.error("Error fetching availability data by range:", error.message);
        res.status(500).json({
            status: "error",
            message: "Error while fetching the data",
            error: error.message
        });
    }
}

module.exports = { 
    availabilityData, 
    getAvailabilityDataByRange, 
    getAvailabilityDataByDate, 
    getAvailabilityData 
};