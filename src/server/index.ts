import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
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

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

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
  // 先服务静态文件
  app.use(express.static(clientDir));
  // 然后处理所有其他路由，返回 index.html（SPA 路由）
  app.get('*', (req, res) => {
    // 不是 API 请求才返回 index.html
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientDir, 'index.html'));
    } else {
      res.status(404).json({ error: 'API not found' });
    }
  });
}

// 允许从任何 IP 地址访问
app.listen(PORT, '0.0.0.0', () => {
  const hostname = require('os').hostname();
  const interfaces = require('os').networkInterfaces();
  let ipAddress = 'localhost';
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // 跳过内部和 IPv6 地址
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
