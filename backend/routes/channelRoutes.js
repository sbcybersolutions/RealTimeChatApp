// routes/channelRoutes.js
const express = require('express');
const router = express.Router();
const Channel = require('../models/Channel'); // Import the Channel model
const { protect } = require('../middleware/authMiddleware'); // Import the protect middleware

// @desc    Get all channels
// @route   GET /api/channels
// @access  Public (anyone can see available channels)
router.get('/', async (req, res) => {
    try {
        const channels = await Channel.find({});
        res.json(channels);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching channels' });
    }
});

// @desc    Create a new channel
// @route   POST /api/channels
// @access  Private (requires authentication)
router.post('/', protect, async (req, res) => {
    const { name, description } = req.body;

    if (!name) {
        return res.status(400).json({ message: 'Channel name is required' });
    }

    try {
        // Check if channel already exists
        const existingChannel = await Channel.findOne({ name });
        if (existingChannel) {
            return res.status(400).json({ message: 'Channel with this name already exists' });
        }

        const channel = await Channel.create({
            name,
            description,
        });

        res.status(201).json(channel);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error creating channel' });
    }
});

module.exports = router;