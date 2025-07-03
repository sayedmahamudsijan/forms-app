const express = require('express');
const { getUsers, getAdminUsers, updateUser } = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const router = express.Router();

router.get('/', authMiddleware, (req, res, next) => {
  console.log(`✅ Accessing GET /api/users for User ID ${req.user?.id}`, {
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
  getUsers(req, res, next);
});

router.get('/admin', authMiddleware, adminMiddleware, (req, res, next) => {
  console.log(`✅ Accessing GET /api/users/admin for User ID ${req.user?.id}`, {
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
  getAdminUsers(req, res, next);
});

router.put('/:id', authMiddleware, adminMiddleware, (req, res, next) => {
  console.log(`✅ Accessing PUT /api/users/:id for User ID ${req.user?.id}`, {
    target_user_id: req.params.id,
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
  updateUser(req, res, next);
});

module.exports = router;