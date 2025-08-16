const apiClient = require("../config/apiClient");
const ResendingData = [];

setInterval(()=>{
    ResendingData.length = 0; },30 * 60 * 1000); 

async function resendDownlink(devEui, deviceName, data) {
  try {
   
    const downlinkResponse = await apiClient.post(`/api/devices/${devEui}/queue`, {
      deviceQueueItem: {
        data: data,
        fPort: 1,
        confirmed: true,
      },
    });

    if (!downlinkResponse.data.id) {
      throw new Error(`Failed to resend downlink for device ${devEui}`);
    }

    ResendingData.push({
      devEui,
      deviceName,
      status: "Downlink resent successfully",
      timeStamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Error resending downlink:", error.message);
    throw new Error(`Failed to resend downlink for device ${devEui}: ${error.message}`);
  }
}

module.exports = {
  resendDownlink,
  ResendingData,
};
