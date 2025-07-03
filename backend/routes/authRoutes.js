const express = require('express');
const { register, login, getMe, updateMe } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Note: Add error handling middleware in server.js for uncaught errors
router.post('/register', ...register, (req, res, next) => {
  console.log(`✅ Accessing POST /api/auth/register`, {
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
});

router.post('/login', ...login, (req, res, next) => {
  console.log(`✅ Accessing POST /api/auth/login`, {
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
});

router.get('/me', authMiddleware, (req, res, next) => {
  console.log(`✅ Accessing GET /api/auth/me for User ID ${req.user.id}`, {
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
  getMe(req, res, next);
});

router.put('/me', authMiddleware, ...updateMe, (req, res, next) => {
  console.log(`✅ Accessing PUT /api/auth/me for User ID ${req.user.id}`, {
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;