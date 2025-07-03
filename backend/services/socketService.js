const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

// Note: Call initSocket in server.js with HTTP server instance
const initSocket = (server) => {
  const origins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
    : ['http://localhost:3000', 'https://forms-app-9zln.onrender.com', 'https://forms-app-sayed-mahmuds-projects-2f91c151.vercel.app'];

  io = socketIO(server, {
    cors: { origin: origins, methods: ['GET', 'POST'], credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      console.error('❌ Socket authentication: No token provided', {
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      });
      return next(new Error('Authentication error: No token provided'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      console.log(`✅ Socket authentication: User ID ${decoded.id} verified`, {
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      });
      next();
    } catch (err) {
      console.error('❌ Socket authentication: Invalid token', {
        socketId: socket.id,
        message: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString(),
      });
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ Socket connected: User ID ${socket.user?.id}`, {
      socketId: socket.id,
      timestamp: new Date().toISOString(),
    });

    socket.on('joinTemplate', (templateId) => {
      const room = `template_${templateId}`;
      socket.join(room);
      console.log(`✅ Socket ${socket.id} joined room ${room} for User ID ${socket.user?.id}`, {
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('disconnect', () => {
      console.log(`✅ Socket disconnected: User ID ${socket.user?.id}`, {
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      });
    });
  });
};

const emitComment = (templateId, comment) => {
  if (io) {
    io.to(`template_${templateId}`).emit('comment', comment);
    console.log(`✅ Emitted comment to template_${templateId}`, {
      commentId: comment.id,
      timestamp: new Date().toISOString(),
    });
  } else {
    console.warn('⚠️ Socket.io not initialized yet. Cannot emit comment.', {
      templateId,
      timestamp: new Date().toISOString(),
    });
  }
};

module.exports = { initSocket, emitComment };