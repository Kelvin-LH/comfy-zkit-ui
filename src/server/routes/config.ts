import { Router } from 'express';
import { getAllConfig, setConfigValue, getConfigValue } from '../services/dataStore.js';
import { authMiddleware, adminMiddleware } from './auth.js';

const router = Router();

// Get all config (public)
router.get('/', (req, res) => {
  const config = getAllConfig();
  res.json(config);
});

// Get specific config (public)
router.get('/:key', (req, res) => {
  const value = getConfigValue(req.params.key);
  res.json({ key: req.params.key, value: value || '' });
});

// Set config (admin only)
router.post('/', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { key, value } = req.body;
    
    if (!key) {
      return res.status(400).json({ error: '配置项名称不能为空' });
    }

    setConfigValue(key, value || '');
    res.json({ success: true });
  } catch (error) {
    console.error('Set config error:', error);
    res.status(500).json({ error: '保存配置失败' });
  }
});

export { router as configRouter };
