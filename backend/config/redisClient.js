// config/redisClient.js
const { createClient } = require('redis');

let redisClient;

const connectRedis = async () => {
    if (redisClient && redisClient.isReady) {
        console.log('Redis client already connected.');
        return redisClient;
    }

    try {
        redisClient = createClient({
            url: process.env.REDIS_URL, // Use the REDIS_URL from your .env
        });

        redisClient.on('error', (err) => console.error('Redis Client Error', err));

        await redisClient.connect();
        console.log('Connected to Redis!');
        return redisClient;
    } catch (error) {
        console.error('Could not connect to Redis:', error);
        // Exit process if Redis connection fails, or handle gracefully
        // For critical apps, you might want to exit. For chat, perhaps just log.
        process.exit(1);
    }
};

// This function will return the connected client instance
const getRedisClient = () => {
    if (!redisClient || !redisClient.isReady) {
        // Optionally, try to connect if not already connected (though connectRedis should be called at startup)
        // console.warn('Redis client not ready. Attempting to reconnect.');
        // connectRedis(); // This might lead to issues if called repeatedly
        throw new Error('Redis client not connected or not ready.');
    }
    return redisClient;
};

module.exports = { connectRedis, getRedisClient };