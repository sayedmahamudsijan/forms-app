const express = require('express');
const { getTopics, createTopic } = require('../controllers/topicController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const router = express.Router();

router.get('/', (req, res, next) => {
  console.log(`✅ Accessing GET /api/topics for User ID ${req.user?.id || 'unauthenticated'}`, {
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
  getTopics(req, res, next);
});

router.post('/', authMiddleware, adminMiddleware, (req, res, next) => {
  console.log(`✅ Accessing POST /api/topics for User ID ${req.user?.id}`, {
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
  createTopic(req, res, next);
});

module.exports = router;