const axios = require("axios");

const apiClient = axios.create({
    baseURL: process.env.API_URL,
    timeout: 5000,
    headers: {
        'Grpc-Metadata-Authorization': `Bearer ${process.env.API_TOKEN}`,
        'accept': 'application/json',
    }
});


module.exports = apiClient;