const apiClient = require("../config/apiClient");
const ResendingData = [];

setInterval(() => {
  ResendingData.length = 0;
}, 30 * 60 * 1000); // clear every 30 minutes

async function resendDownlink(devEui, deviceName, data, fPort) {
  try {
    const validFPort = (typeof fPort === "number" && fPort >= 1 && fPort <= 255) ? fPort : 1;

    const downlinkResponse = await apiClient.post(`/api/devices/${devEui}/queue`, {
     queueItem: {
        data,
        fCnt: 0,
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

    console.log(`✅ Resent downlink to ${deviceName} (${devEui}) on FPort ${validFPort}`);
  } catch (error) {
    console.error(`❌ Error resending downlink for ${devEui}:`, error.response?.data || error.message);
    throw new Error(`Failed to resend downlink for ${devEui}: ${error.message}`);
  }
}


module.exports = {
  resendDownlink,
  ResendingData,
};
