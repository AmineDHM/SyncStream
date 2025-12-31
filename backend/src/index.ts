import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { setupSocketHandlers } from './socketHandlers';
import { hlsProxyRouter } from './hlsProxy';
import { config } from './config';

const app = express();
const httpServer = createServer(app);

// Trust proxy for Render/production
app.set('trust proxy', 1);

// CORS configuration - allow multiple origins for production
const allowedOrigins = [
  config.clientUrl,
  'http://localhost:5173',
  'http://localhost:5174',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.some(allowed => origin.startsWith(allowed.replace(/\/$/, '')))) {
      return callback(null, true);
    }
    
    console.warn(`Blocked CORS request from: ${origin}`);
    callback(null, false);
  },
  credentials: true,
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    env: config.nodeEnv,
  });
});

app.get('/', (_req, res) => {
  res.json({ 
    name: 'SyncStream API',
    version: '1.0.0',
    status: 'running',
  });
});

// HLS Proxy routes
app.use('/proxy', hlsProxyRouter);

// Socket.IO setup
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
});

// Setup socket handlers
setupSocketHandlers(io);

// Start server
httpServer.listen(config.port, () => {
  console.log(`🚀 SyncStream server running on port ${config.port}`);
  console.log(`📡 Environment: ${config.nodeEnv}`);
  console.log(`🌐 Allowed origins: ${allowedOrigins.join(', ')}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('Shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  
  // Force close after 10s
  setTimeout(() => {
    console.error('Forced shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
