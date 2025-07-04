const express = require('express');
const { register, login, getMe, updateMe, refreshToken } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

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

router.post('/refresh-token', authMiddleware, (req, res, next) => {
  console.log(`✅ Accessing POST /api/auth/refresh-token for User ID ${req.user.id}`, {
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
  refreshToken(req, res, next);
});

module.exports = router;
