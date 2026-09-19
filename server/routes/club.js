const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// Local request bookmark workspace for the request-transmission demo layer.
let mockMembershipDatabase = {};

// Resolve the authenticated profile out of the JWT payload when a Bearer token is attached.
// Returns the MongoDB user document (with membership fields) or null when offline/tokenless.
async function resolveAuthUser(req) {
    const header = req.headers && req.headers.authorization;
    const token = header && header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return await User.findById(decoded.id).select('name email membershipStatus isClubMember requestedAt');
    } catch (_err) {
        return null;
    }
}

// Unified status lookup across the global fallback repository, then the memory workspace.
function currentStatusOf(userName) {
    const fallbackUser = Array.isArray(global.fallbackUsersDatabase)
        ? global.fallbackUsersDatabase.find((u) => u.name === userName)
        : null;
    if (fallbackUser) return fallbackUser.membershipStatus || 'none';
    return mockMembershipDatabase[userName] || 'none';
}

// A. ACCESS VERIFICATION ENDPOINT
// Verifies the authenticated user's live status against the User collection when a token
// is present; otherwise reads the shared global fallback users repository.
router.get('/verify', async (req, res) => {
    try {
        const user = await resolveAuthUser(req);
        if (user) {
            const currentStatus = user.membershipStatus || 'none';
            return res.status(200).json({
                allowed: currentStatus === 'approved',
                status: currentStatus,
                user: user.name,
            });
        }
    } catch (_err) {
        /* fall through to the global fallback repository */
    }

    const mockUserKey = 'KUNJ';
    const currentStatus = currentStatusOf(mockUserKey);

    return res.status(200).json({
        allowed: currentStatus === 'approved',
        status: currentStatus,
        user: mockUserKey,
    });
});

// B. MEMBERSHIP TRANSMISSION REQUEST ENDPOINT
// Queues the application by flipping the authenticated profile to 'pending' in the User
// collection when reachable, and always mirrors the state into the shared global
// fallback users repository so the CMS clearance console can see it instantly.
router.post('/request', async (req, res) => {
    const mockUserKey = 'KUNJ';
    let appliedUser = null;

    try {
        const user = await resolveAuthUser(req);
        if (user) {
            user.membershipStatus = 'pending';
            user.isClubMember = false;
            user.requestedAt = new Date();
            await user.save();
            appliedUser = user;
            console.log(`[club] DB membership state for user ${user.name} successfully updated to PENDING.`);
        }
    } catch (_err) {
        /* DB layer unavailable — fallback repository handles this cycle */
    }

    // Mirror the pending state into the shared global fallback users repository
    const fallbackUser = Array.isArray(global.fallbackUsersDatabase)
        ? global.fallbackUsersDatabase.find((u) => u.name === mockUserKey)
        : null;
    if (fallbackUser) {
        fallbackUser.membershipStatus = 'pending';
        fallbackUser.isClubMember = false;
    }

    // Set status to pending in our server memory workspace
    mockMembershipDatabase[mockUserKey] = 'pending';
    console.log(`[Server] Membership state for user ${mockUserKey} successfully updated to PENDING.`);

    return res.status(200).json({
        success: true,
        status: 'pending',
        user: appliedUser ? appliedUser.name : mockUserKey,
        message: 'Application queued and processed server-side.'
    });
});

// NOTE: The /api/club/admin/pending + /api/club/admin/action moderation endpoints are
// owned by the unified route matrix in server.js (backed by global.fallbackUsersDatabase).

module.exports = router;