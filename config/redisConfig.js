const redis= require('ioredis')

const redisClient = new redis({
    port: process.env.REDIS_PORT,
    host: process.env.REDIS_HOST,
})

module.exports = redisClient;