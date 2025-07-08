// models/Message.js
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    channel: {
        type: String, // Or mongoose.Schema.Types.ObjectId if channels were stored in DB
        required: true,
        trim: true,
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId, // Reference to the User model
        ref: 'User',
        required: true,
    },
    senderUsername: { // Store username directly for faster display
        type: String,
        required: true,
    },
    content: {
        type: String,
        required: true,
        trim: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
});

// Optional: Add an index for faster querying by channel and timestamp
MessageSchema.index({ channel: 1, timestamp: -1 });

module.exports = mongoose.model('Message', MessageSchema);