const express = require('express');
const { toggleLike } = require('../controllers/likeController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/:template_id/likes', authMiddleware, (req, res, next) => {
  console.log(`✅ Accessing POST /api/:template_id/likes for User ID ${req.user?.id}`, {
    template_id: req.params.template_id,
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
  toggleLike(req, res, next);
});

module.exports = router;