const express = require('express');
const { getAllTags } = require('../controllers/tagController');
const router = express.Router();

/**
 * GET /api/tags
 * Public route to fetch all tags
 */
router.get('/', (req, res, next) => {
  console.log(`✅ Accessing GET /api/tags for User ID ${req.user?.id || 'unauthenticated'}`, {
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
  getAllTags(req, res, next);
});

module.exports = router;