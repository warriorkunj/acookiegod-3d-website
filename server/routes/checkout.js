const express = require('express');
const { createSession } = require('../controllers/checkoutController');
const { optionalAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// Guest-friendly: attaches req.user when a valid JWT is supplied, never blocks.
// Prices are always recomputed server-side inside the controller.
router.post('/create-session', optionalAuth, createSession);

module.exports = router;