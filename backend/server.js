const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const multer = require('multer');
const dotenv = require('dotenv');
const db = require('./models');
const { initSocket } = require('./services/socketService');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Invalid file type. Only JPEG, PNG, or GIF allowed.'));
    }
    cb(null, true);
  },
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()).filter(o => o)
      : ['http://localhost:3000', 'https://forms-app-9zln.onrender.com', 'https://forms-app-sayed-mahmuds-projects-2f91c151.vercel.app'];
    console.log(`✅ CORS Request Origin: ${origin || 'none'}`, {
      allowedOrigins,
      timestamp: new Date().toISOString(),
    });
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  console.log(`✅ Request: ${req.method} ${req.originalUrl}`, {
    userId: req.user?.id,
    timestamp: new Date().toISOString(),
  });
  next();
});

// Initialize WebSocket
initSocket(server);

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log(`✅ Health check accessed`, { timestamp: new Date().toISOString() });
  res.json({ success: true, message: 'Server is running', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/templates', upload.single('image'), require('./routes/templateRoutes'));
app.use('/api/forms', require('./routes/formRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/comments', require('./routes/commentRoutes'));
app.use('/api/topics', require('./routes/topicRoutes'));
app.use('/api/tags', require('./routes/tagRoutes'));
app.use('/api/likes', require('./routes/likeRoutes'));

// 404 Handler
app.use((req, res, next) => {
  console.error(`❌ Route not found: ${req.method} ${req.originalUrl}`, {
    timestamp: new Date().toISOString(),
  });
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found` });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', {
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.id,
    timestamp: new Date().toISOString(),
  });
  res.status(500).json({ success: false, message: 'Server error', error: err.message });
});

// Start server (relying on migrations for schema management)
const PORT = process.env.PORT || 5000;
const startServer = async () => {
  try {
    console.log('✅ Starting server', { timestamp: new Date().toISOString() });
    // Verify database connection
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful', { timestamp: new Date().toISOString() });
    server.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`, { timestamp: new Date().toISOString() });
    });
  } catch (err) {
    console.error('❌ Database connection failed:', {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    });
    console.warn('⚠️ Server failed to start due to database error.', {
      timestamp: new Date().toISOString(),
    });
  }
};

startServer();