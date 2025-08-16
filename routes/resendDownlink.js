import express from "express";
import { ResendingData } from "../services/resendDownlink.js";

const ResendDownlink = express.Router();

ResendDownlink.get("/resendDownlink", async (_, res) => {
    try {

        const result = [...ResendingData].reverse();
        if (result.length === 0) {
            return res.status(404).json({ success: false, message: "No resend downlink data found", count: 0 });
        }
        return res.status(200).json({ success: true, data: result, count: result.length });
        
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

module.exports = ResendDownlink;