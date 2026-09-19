const asyncHandler = require('../utils/asyncHandler');
const generateToken = require('../utils/generateToken');
const User = require('../models/User');

const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id);
  res.status(statusCode).json({
    success: true,
    token,
    user: { id: user._id, name: user.name, email: user.email },
  });
};

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    const err = new Error('Please provide name, email and password.');
    err.statusCode = 400;
    throw err;
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const exists = await User.findOne({ email: normalizedEmail });
  if (exists) {
    const err = new Error('An account with this email already exists.');
    err.statusCode = 409;
    throw err;
  }

  // Password is bcrypt-hashed automatically in the User pre-save hook.
  const user = await User.create({
    name: String(name).trim(),
    email: normalizedEmail,
    password: String(password),
  });

  sendTokenResponse(user, 201, res);
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    const err = new Error('Please provide email and password.');
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+password');
  if (!user || !(await user.matchPassword(String(password)))) {
    const err = new Error('Invalid email or password.');
    err.statusCode = 401;
    throw err;
  }

  sendTokenResponse(user, 200, res);
});

// GET /api/auth/me  (protected — requires Bearer token)
const getMe = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    user: { id: req.user._id, name: req.user.name, email: req.user.email },
  });
});

module.exports = { register, login, getMe };