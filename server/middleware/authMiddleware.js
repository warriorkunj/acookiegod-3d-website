const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');

// Hard gate: blocks non-authenticated requests from reaching protected roots.
const protect = asyncHandler(async (req, _res, next) => {
  let token = null;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) token = header.slice(7).trim();

  if (!token) {
    const err = new Error('Not authorized — no token provided.');
    err.statusCode = 401;
    throw err;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      const err = new Error('Not authorized — user no longer exists.');
      err.statusCode = 401;
      throw err;
    }
    req.user = user;
    next();
  } catch (err) {
    err.statusCode = 401;
    err.message = 'Not authorized — invalid or expired token.';
    throw err;
  }
});

// Soft gate: attaches req.user when a valid token is sent, never blocks.
// Used for guest checkout that becomes "logged-in" when a token exists.
const optionalAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ')
    ? header.slice(7).trim()
    : null;
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (user) req.user = user;
  } catch (_err) {
    /* invalid token ignored — treat as guest */
  }
  next();
});

module.exports = { protect, optionalAuth };