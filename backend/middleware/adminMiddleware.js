const { User } = require('../models');

const adminMiddleware = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      console.error('❌ Admin middleware: No user in request', {
        method: req.method,
        url: req.originalUrl,
        timestamp: new Date().toISOString(),
      });
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const user = await User.findByPk(req.user.id, { attributes: ['id', 'is_admin'] });
    if (!user) {
      console.error('❌ Admin middleware: User not found', {
        user_id: req.user.id,
        method: req.method,
        url: req.originalUrl,
        timestamp: new Date().toISOString(),
      });
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.is_admin) {
      console.error('❌ Admin middleware: User is not admin', {
        user_id: req.user.id,
        method: req.method,
        url: req.originalUrl,
        timestamp: new Date().toISOString(),
      });
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    console.log(`✅ Admin middleware: Access granted for User ID ${req.user.id}`, {
      method: req.method,
      url: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
    next();
  } catch (error) {
    console.error('❌ Admin middleware error:', {
      user_id: req.user?.id,
      method: req.method,
      url: req.originalUrl,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = adminMiddleware;