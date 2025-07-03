const jwt = require('jsonwebtoken');
const { User } = require('../models');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    console.error('❌ Auth middleware: No token provided', {
      method: req.method,
      url: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    console.error('❌ Auth middleware: Malformed token', {
      method: req.method,
      url: req.originalUrl,
      authHeader,
      timestamp: new Date().toISOString(),
    });
    return res.status(401).json({ success: false, message: 'Malformed token: Expected Bearer <token>' });
  }

  if (!process.env.JWT_SECRET) {
    console.error('❌ Auth middleware: JWT_SECRET not configured', {
      method: req.method,
      url: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
    return res.status(500).json({ success: false, message: 'Server configuration error' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.id || !Number.isInteger(decoded.id) || decoded.id <= 0) {
      console.error('❌ Auth middleware: Invalid user ID in token', {
        decoded: { id: decoded.id, email: decoded.email },
        method: req.method,
        url: req.originalUrl,
        timestamp: new Date().toISOString(),
      });
      return res.status(403).json({ success: false, message: 'Invalid token: Invalid user ID' });
    }

    // Fetch user to ensure email and is_admin are included
    User.findByPk(decoded.id, {
      attributes: ['id', 'email', 'is_admin'],
    })
      .then(user => {
        if (!user) {
          console.error('❌ Auth middleware: User not found', {
            userId: decoded.id,
            method: req.method,
            url: req.originalUrl,
            timestamp: new Date().toISOString(),
          });
          return res.status(404).json({ success: false, message: 'User not found' });
        }

        req.user = {
          id: user.id,
          email: user.email,
          is_admin: user.is_admin,
        };
        console.log(`✅ Auth middleware: Token verified for User ID ${user.id}`, {
          method: req.method,
          url: req.originalUrl,
          user: { id: user.id, email: user.email, is_admin: user.is_admin },
          timestamp: new Date().toISOString(),
        });
        next();
      })
      .catch(err => {
        console.error('❌ Auth middleware: Database error', {
          userId: decoded.id,
          method: req.method,
          url: req.originalUrl,
          error: err.message,
          stack: err.stack,
          timestamp: new Date().toISOString(),
        });
        return res.status(500).json({ success: false, message: 'Server error' });
      });
  } catch (err) {
    let message = 'Invalid token';
    let status = 403;

    if (err.name === 'TokenExpiredError') {
      message = 'Token expired';
      status = 401;
    } else if (err.name === 'JsonWebTokenError') {
      message = 'Invalid token format';
    }

    console.error(`❌ Auth middleware: JWT verification error - ${err.name}`, {
      method: req.method,
      url: req.originalUrl,
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    });
    return res.status(status).json({ success: false, message });
  }
}

module.exports = authMiddleware;