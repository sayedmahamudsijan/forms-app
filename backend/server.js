const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const multer = require('multer');
const dotenv = require('dotenv');
const db = require('./models');
const { initSocket } = require('./services/socketService');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config({ debug: process.env.NODE_ENV !== 'production' });

// Validate critical environment variables
const requiredEnvVars = ['DATABASE_URL', 'CORS_ORIGINS'];
requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    console.error(`❌ Missing environment variable: ${varName}`, {
      timestamp: new Date().toISOString(),
    });
    process.exit(1);
  }
});

const app = express();
const server = http.createServer(app);

// Ensure Uploads directory exists
const uploadDir = path.join(__dirname, 'Uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`✅ Created Uploads directory: ${uploadDir}`, { timestamp: new Date().toISOString() });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalName)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'video/mp4',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      console.error(`❌ Multer: Invalid file type ${file.mimetype}`, {
        field: file.fieldname,
        timestamp: new Date().toISOString(),
      });
      return cb(new Error('Invalid file type. Only JPEG, PNG, GIF, PDF, MP4, DOC, or DOCX allowed.'));
    }
    cb(null, true);
  },
});

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter((o) => o);
      console.log(`✅ CORS Request Origin: ${origin || 'none'}`, {
        allowedOrigins,
        timestamp: new Date().toISOString(),
      });
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.error(`❌ CORS rejected: ${origin}`, { timestamp: new Date().toISOString() });
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`✅ Request: ${req.method} ${req.originalUrl}`, {
      userId: req.user?.id || 'unauthenticated',
      timestamp: new Date().toISOString(),
    });
  }
  next();
});

// Initialize WebSocket
try {
  initSocket(server);
  console.log(`✅ WebSocket initialized`, { timestamp: new Date().toISOString() });
} catch (err) {
  console.error(`❌ WebSocket initialization failed: ${err.message}`, {
    stack: err.stack,
    timestamp: new Date().toISOString(),
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log(`✅ Health check accessed`, { timestamp: new Date().toISOString() });
  res.json({ success: true, message: 'Server is running', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use(
  '/api/templates',
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'questionAttachments', maxCount: 10 },
  ]),
  require('./routes/templateRoutes')
);
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
    userId: req.user?.id || 'unauthenticated',
    timestamp: new Date().toISOString(),
  });
  res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
});

// Start server
const PORT = process.env.PORT || 5000;
const startServer = async () => {
  try {
    console.log('✅ Starting server', { timestamp: new Date().toISOString() });
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful', { timestamp: new Date().toISOString() });
    // Ensure schema is up-to-date (uncomment in development if needed)
    // await db.sequelize.sync({ force: false });
    server.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`, { timestamp: new Date().toISOString() });
    });
  } catch (err) {
    console.error('❌ Database connection failed:', {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    });
    console.warn('⚠️ Retrying database connection in 5 seconds...', { timestamp: new Date().toISOString() });
    setTimeout(startServer, 5000);
  }
};

startServer();

module.exports = app;
