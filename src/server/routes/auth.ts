import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getUserByUsername, createUser, getUserById, updateUser, getUsers } from '../services/dataStore.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'comfy-zkit-secret-key-2024';

// Middleware to verify JWT token
export function authMiddleware(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    const user = getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: '登录已过期' });
  }
}

// Admin middleware
export function adminMiddleware(req: any, res: any, next: any) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
}

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '请输入用户名和密码' });
    }

    const user = getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // Check if this is the first login for admin (default password)
    if (user.username === 'admin' && user.password.startsWith('$2a$10$rQnM1')) {
      // First time login, set the password
      const hashedPassword = await bcrypt.hash(password, 10);
      updateUser(user.id, { password: hashedPassword });
    } else {
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: '用户名或密码错误' });
      }
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// Register (admin only can create users)
router.post('/register', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { username, password, role = 'user' } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '请输入用户名和密码' });
    }

    const existingUser = getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = createUser({
      username,
      password: hashedPassword,
      role: role as 'admin' | 'user'
    });

    res.json({
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: '注册失败' });
  }
});

// Get current user
router.get('/me', authMiddleware, (req: any, res) => {
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role
    }
  });
});

// Change password
router.post('/change-password', authMiddleware, async (req: any, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '请输入旧密码和新密码' });
    }

    const isValid = await bcrypt.compare(oldPassword, req.user.password);
    if (!isValid) {
      return res.status(401).json({ error: '旧密码错误' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    updateUser(req.user.id, { password: hashedPassword });

    res.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: '修改密码失败' });
  }
});

// List users (admin only)
router.get('/users', authMiddleware, adminMiddleware, (req, res) => {
  const users = getUsers();
  res.json({
    users: users.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      createdAt: u.createdAt
    }))
  });
});

export { router as authRouter };
