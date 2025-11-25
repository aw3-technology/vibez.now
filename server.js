require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;
const path = require('path');

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'"],
      "script-src-attr": ["'unsafe-inline'"],
    },
  },
}));
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Vibez.now backend is running',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.get('/api/v1', (req, res) => {
  res.json({
    message: 'Welcome to Vibez.now API',
    version: '1.0.0'
  });
});

// Example endpoint
app.get('/api/v1/vibez', (req, res) => {
  res.json({
    vibez: [
      { id: 1, name: 'Good Vibes', mood: 'happy' },
      { id: 2, name: 'Chill Vibes', mood: 'relaxed' }
    ]
  });
});

// Auth routes
const authRoutes = require('./src/routes/auth');
app.use('/api/auth', authRoutes);

// Agent routes
const agentRoutes = require('./src/routes/agent');
app.use('/api/agent', agentRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Vibez.now backend listening on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
