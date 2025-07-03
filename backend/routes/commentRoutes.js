const express = require('express');
const { addComment, getComments } = require('../controllers/commentController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/:template_id/comments', authMiddleware, (req, res, next) => {
  console.log(`✅ Accessing POST /api/:template_id/comments for User ID ${req.user?.id}`, {
    template_id: req.params.template_id,
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
  addComment(req, res, next);
});

router.get('/:template_id/comments', authMiddleware, (req, res, next) => {
  console.log(`✅ Accessing GET /api/:template_id/comments for User ID ${req.user?.id}`, {
    template_id: req.params.template_id,
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
  getComments(req, res, next);
});

module.exports = router;