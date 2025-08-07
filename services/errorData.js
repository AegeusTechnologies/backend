// Create a Map to store error data with a maximum age limit
const errorMap = new Map();

/**
 * Stores error data for a specific device
 * @param {string} devEui - Device EUI identifier
 * @param {string|object} errorMessage - Error message or object
 * @returns {Promise<object>} The stored error data
 * @throws {Error} If required parameters are missing
 */
async function getAllErrorData(devEui,deviceName, errorMessage) {
    try {
        if (!devEui) {
            throw new Error('DevEUI and error message are required');
        }

        const key = devEui;
        const date = new Date().toLocaleDateString(); 
        
        // Store in Map with device ID as key and error details as value
        errorMap.set(key, {
            robotName: deviceName,
            error: errorMessage,
            timestamp: date
        });

        return errorMap.get(key);
    } catch (error) {
        console.error('Error in getAllErrorData:', error);
        throw error;
    }
}

/**
 * Retrieves all stored error data
 * @returns {Promise<Array>} Array of error data objects
 */
async function getErrorData(_, res) {
    try {
       res.status(200).json({
            success: true,
            message: "Error data retrieved successfully",
            data: Array.from(errorMap.values())
        });
    } catch (error) {
        console.error('Error in getErrorData:', error);
        throw error;
    }
}

module.exports = { getAllErrorData, getErrorData };