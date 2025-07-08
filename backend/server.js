// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http'); // Import http module for Socket.io
const { Server } = require('socket.io'); // Import Server from socket.io
const connectDB = require('./config/db');
const { connectRedis, getRedisClient } = require('./config/redisClient'); // Get our Redis client
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const channelRoutes = require('./routes/channelRoutes');
const Message = require('./models/Message'); // Import Message model
const User = require('./models/User'); // Import User model
const jwt = require('jsonwebtoken'); // To verify JWT for socket auth

// Connect to MongoDB
connectDB();
// Connect to Redis
let redisClient; // Declare redisClient here
connectRedis().then(client => {
    redisClient = client; // Assign the connected client
}).catch(err => {
    console.error("Failed to connect Redis on startup:", err);
    process.exit(1);
});


const app = express();
const server = http.createServer(app); // Create an HTTP server from Express app

// Initialize Socket.io server
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000", // Allow requests from our React frontend
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(express.json());
app.use(cors());

// Basic route
app.get('/', (req, res) => {
    res.send('Chat App Backend is running!');
});

// Use API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/channels', channelRoutes);

// Socket.io Authentication Middleware (for handshake)
// This runs before a client connects to Socket.io
io.use(async (socket, next) => {
    const token = socket.handshake.auth.token; // Get token from handshake auth
    if (!token) {
        return next(new Error('Authentication error: No token provided'));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            return next(new Error('Authentication error: User not found'));
        }
        socket.user = user; // Attach user object to the socket
        next(); // Proceed with connection
    } catch (error) {
        console.error('Socket authentication failed:', error.message);
        return next(new Error('Authentication error: Invalid token'));
    }
});


// Socket.io connection handling
io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.user.username} (ID: ${socket.user._id})`);

    const userId = socket.user._id.toString();
    const username = socket.user.username;

    // Set user as online in Redis (globally)
    // We'll use a SET to store online user IDs
    await redisClient.sAdd('onlineUsers', userId); // sAdd is for Set Add

    // --- Event Listeners for Chat Functionality ---

    // 1. Join Channel
    socket.on('joinChannel', async (channelName) => {
        // Leave any previously joined rooms (channels)
        socket.rooms.forEach(room => {
            if (room !== socket.id) { // Don't leave the default personal room
                socket.leave(room);
                // Remove user from the old channel's online list in Redis
                redisClient.sRem(`channel:${room}:online`, userId);
                console.log(`${username} left channel: ${room}`);
                io.to(room).emit('userLeft', { userId, username, channel: room });
            }
        });

        socket.join(channelName);
        socket.currentChannel = channelName; // Store current channel on socket for easy access

        // Add user to the new channel's online list in Redis
        await redisClient.sAdd(`channel:${channelName}:online`, userId);
        console.log(`${username} joined channel: ${channelName}`);

        // Emit 'userJoined' to everyone in the channel (including the joining user)
        io.to(channelName).emit('userJoined', { userId, username, channel: channelName });

        // Fetch and send message history for the joined channel
        try {
            const messages = await Message.find({ channel: channelName })
                                         .sort({ timestamp: 1 }) // Sort by oldest first
                                         .limit(50); // Limit number of messages
            socket.emit('messageHistory', messages); // Send history only to the joining client
        } catch (error) {
            console.error('Error fetching message history:', error);
            socket.emit('error', 'Failed to fetch message history.');
        }

        // Send updated online users list for the current channel to the joining client
        await sendOnlineUsersList(channelName);
    });

    // 2. Send Message
    socket.on('sendMessage', async ({ channel, content }) => {
        if (!channel || !content) {
            return socket.emit('error', 'Channel and content are required to send a message.');
        }
        if (socket.currentChannel !== channel) {
             return socket.emit('error', 'You are not in this channel.');
        }

        try {
            const newMessage = new Message({
                channel,
                sender: userId,
                senderUsername: username,
                content,
            });
            await newMessage.save();

            // Emit the new message to everyone in that channel
            io.to(channel).emit('receiveMessage', {
                _id: newMessage._id,
                channel: newMessage.channel,
                sender: newMessage.sender,
                senderUsername: newMessage.senderUsername,
                content: newMessage.content,
                timestamp: newMessage.timestamp,
            });
            console.log(`Message in ${channel} from ${username}: ${content}`);
        } catch (error) {
            console.error('Error saving or sending message:', error);
            socket.emit('error', 'Failed to send message.');
        }
    });

    // 3. Request Online Users (can be emitted by client if needed, or after join)
    socket.on('requestOnlineUsers', async (channelName) => {
        await sendOnlineUsersList(channelName, socket); // Send to requesting socket
    });

    // Helper to send online users list for a given channel
    const sendOnlineUsersList = async (channelName, targetSocket = io) => {
        try {
            const onlineUserIdsInChannel = await redisClient.sMembers(`channel:${channelName}:online`);
            const onlineUsernames = [];
            // For a production app, fetch usernames from DB if not cached
            // For now, let's simulate by just checking if the ID exists in our global online set
            for (const id of onlineUserIdsInChannel) {
                // To get username without another DB call, we could store it in Redis too
                // For simplicity here, we'll assume we have a way to resolve ID to username
                // or retrieve it from a globally managed online users map (if building one)
                const userObj = await User.findById(id).select('username');
                if (userObj) {
                    onlineUsernames.push({ id: userObj._id, username: userObj.username });
                }
            }
            targetSocket.to(channelName).emit('onlineUsersUpdate', {
                channel: channelName,
                users: onlineUsernames
            });
            console.log(`Online users in ${channelName}:`, onlineUsernames.length);
        } catch (error) {
            console.error('Error sending online users list:', error);
        }
    };


    // 4. Disconnect
    socket.on('disconnect', async () => {
        console.log(`User disconnected: ${username} (ID: ${userId})`);

        // Remove user from global online users set
        await redisClient.sRem('onlineUsers', userId);

        // Remove user from the specific channel's online set they were in
        if (socket.currentChannel) {
            await redisClient.sRem(`channel:${socket.currentChannel}:online`, userId);
            // Notify others in that channel that a user left
            io.to(socket.currentChannel).emit('userLeft', { userId, username, channel: socket.currentChannel });
            console.log(`${username} left channel: ${socket.currentChannel}`);
        }
        // No need to send online users update for the specific channel when userLeft is emitted
        // Clients will handle removing the user from their local list
    });
});


// Start the server (using http server, not just app)
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => { // Use server.listen, not app.listen
    console.log(`Server running on port ${PORT}`);
    console.log(`Access it at: http://localhost:${PORT}`);
    console.log('Socket.io server initialized.');
});