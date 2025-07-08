// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware'); // Import the protect middleware

// @desc    Get user profile (example of a protected route)
// @route   GET /api/users/profile
// @access  Private (requires authentication)
router.get('/profile', protect, (req, res) => {
    // If we reach here, 'protect' middleware has successfully authenticated the user
    // and attached user info to req.user
    res.json({
        _id: req.user._id,
        username: req.user.username,
        message: 'You have access to your profile data because you are authenticated!'
    });
});

module.exports = router;