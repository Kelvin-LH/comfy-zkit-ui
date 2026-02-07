import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { authRouter } from './routes/auth.js';
import { configRouter } from './routes/config.js';
import { generateRouter } from './routes/generate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware - CORS configuration
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add permissions policy headers for camera access
app.use((req, res, next) => {
  res.header('Permissions-Policy', 'camera=*, microphone=*');
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files with proper headers
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Cache-Control', 'public, max-age=3600');
  next();
}, express.static(uploadsDir));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/config', configRouter);
app.use('/api/generate', generateRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files (both development and production)
const clientDir = path.join(__dirname, '../client');
if (fs.existsSync(clientDir)) {
  // Serve static files first
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Permissions-Policy', 'camera=*, microphone=*');
    next();
  }, express.static(clientDir));
  
  // Then handle all other routes, return index.html (SPA routing)
  app.get('*', (req, res) => {
    // Only return index.html for non-API requests
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientDir, 'index.html'));
    } else {
      res.status(404).json({ error: 'API not found' });
    }
  });
}

// Allow access from any IP address
app.listen(PORT, '0.0.0.0', () => {
  const hostname = os.hostname();
  const interfaces = os.networkInterfaces();
  let ipAddress = 'localhost';
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and IPv6 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        ipAddress = iface.address;
        break;
      }
    }
  }
  
  console.log(`\n✓ 服务器运行在 http://0.0.0.0:${PORT}`);
  console.log(`✓ 本地访问: http://localhost:${PORT}`);
  console.log(`✓ 网络访问: http://${ipAddress}:${PORT}`);
  console.log(`✓ 默认 ComfyUI 地址: http://127.0.0.1:8188`);
  console.log(`✓ 提示: 可在管理设置中自定义 ComfyUI 服务地址\n`);
});

export default app;
