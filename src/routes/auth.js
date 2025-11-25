// Authentication routes
const express = require('express');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

// In-memory user storage (replace with database in production)
const users = new Map();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  const { email, password, username } = req.body;

  // Validation
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required',
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      error: 'Password must be at least 6 characters',
    });
  }

  // Check if user already exists
  if (users.has(email)) {
    return res.status(409).json({
      success: false,
      error: 'User with this email already exists',
    });
  }

  try {
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const user = {
      userId,
      email,
      username: username || email.split('@')[0],
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    };

    users.set(email, user);

    // Generate token
    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        userId: user.userId,
        email: user.email,
        username: user.username,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      error: 'Registration failed',
    });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Validation
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required',
    });
  }

  const user = users.get(email);

  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Invalid email or password',
    });
  }

  try {
    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // Generate token
    const token = generateToken(user);

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        userId: user.userId,
        email: user.email,
        username: user.username,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Login failed',
    });
  }
});

/**
 * POST /api/auth/verify
 * Verify token and get user info
 */
router.post('/verify', require('../middleware/auth').authenticateToken, (req, res) => {
  return res.json({
    success: true,
    user: req.user,
  });
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', require('../middleware/auth').authenticateToken, (req, res) => {
  const user = users.get(req.user.email);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found',
    });
  }

  return res.json({
    success: true,
    user: {
      userId: user.userId,
      email: user.email,
      username: user.username,
      createdAt: user.createdAt,
    },
  });
});

module.exports = router;
