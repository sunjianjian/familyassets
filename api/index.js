const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { kv } = require('@vercel/kv');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'family-assets-secret-key-2024';

app.use(cors());
app.use(express.json());

// KV 数据操作
async function getDB() {
  const data = await kv.get('familyassets:db');
  return data || { users: [], assets: [], nextUserId: 1, nextAssetId: 1 };
}

async function saveDB(data) {
  await kv.set('familyassets:db', data);
}

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: '未登录' });
  try {
    req.userId = jwt.verify(token, JWT_SECRET).userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: '登录已过期' });
  }
};

// 用户注册
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
    if (password.length < 6) return res.status(400).json({ error: '密码长度至少6位' });
    
    const db = await getDB();
    if (db.users.find(u => u.username === username)) {
      return res.status(400).json({ error: '用户名已存在' });
    }
    
    const user = {
      id: db.nextUserId++,
      username,
      password: bcrypt.hashSync(password, 10),
      created_at: new Date().toISOString()
    };
    db.users.push(user);
    await saveDB(db);
    
    res.json({ message: '注册成功', userId: user.id });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: '注册失败: ' + err.message });
  }
});

// 用户登录
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
    
    const db = await getDB();
    const user = db.users.find(u => u.username === username);
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    res.json({
      message: '登录成功',
      token: jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' }),
      username: user.username
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: '登录失败: ' + err.message });
  }
});

// 获取资产
app.get('/api/assets', authMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    const assets = db.assets
      .filter(a => a.user_id === req.userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(assets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 添加资产
app.post('/api/assets', authMiddleware, async (req, res) => {
  try {
    const { name, category, type, amount, description } = req.body;
    if (!name || !type || amount === undefined) {
      return res.status(400).json({ error: '资产名称、类型和金额不能为空' });
    }
    
    const db = await getDB();
    const asset = {
      id: db.nextAssetId++,
      user_id: req.userId,
      name,
      category: category || '',
      type,
      amount: Number(amount),
      description: description || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.assets.push(asset);
    await saveDB(db);
    
    res.json({ message: '添加成功', id: asset.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新资产
app.put('/api/assets/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, category, type, amount, description } = req.body;
    
    const db = await getDB();
    const idx = db.assets.findIndex(a => a.id === id && a.user_id === req.userId);
    if (idx === -1) return res.status(404).json({ error: '资产不存在' });
    
    db.assets[idx] = {
      ...db.assets[idx],
      name,
      category: category || '',
      type,
      amount: Number(amount),
      description: description || '',
      updated_at: new Date().toISOString()
    };
    await saveDB(db);
    
    res.json({ message: '更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除资产
app.delete('/api/assets/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const db = await getDB();
    const idx = db.assets.findIndex(a => a.id === id && a.user_id === req.userId);
    if (idx === -1) return res.status(404).json({ error: '资产不存在' });
    
    db.assets.splice(idx, 1);
    await saveDB(db);
    
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 统计
app.get('/api/statistics', authMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    const userAssets = db.assets.filter(a => a.user_id === req.userId);
    
    const total = userAssets.reduce((sum, a) => sum + a.amount, 0);
    const count = userAssets.length;
    
    const byTypeMap = {};
    userAssets.forEach(a => {
      if (!byTypeMap[a.type]) byTypeMap[a.type] = { type: a.type, amount: 0, count: 0 };
      byTypeMap[a.type].amount += a.amount;
      byTypeMap[a.type].count++;
    });
    
    res.json({ total, count, byType: Object.values(byTypeMap) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
