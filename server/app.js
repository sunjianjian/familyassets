const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'family-assets-secret-key-2024';
const DB_FILE = path.join(__dirname, 'database.json');

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// 数据库操作
function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('加载数据库失败:', err);
  }
  return { users: [], assets: [], nextUserId: 1, nextAssetId: 1 };
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// JWT 认证中间件
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: '登录已过期' });
  }
};

// ============ 用户接口 ============

// 用户注册
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: '密码长度至少6位' });
  }

  const db = loadDB();

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
  saveDB(db);

  res.json({ message: '注册成功', userId: user.id });
});

// 用户登录
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  const db = loadDB();
  const user = db.users.find(u => u.username === username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ message: '登录成功', token, username: user.username });
});

// ============ 资产接口 ============

// 获取资产列表
app.get('/api/assets', authMiddleware, (req, res) => {
  const db = loadDB();
  const assets = db.assets
    .filter(a => a.user_id === req.userId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(assets);
});

// 添加资产
app.post('/api/assets', authMiddleware, (req, res) => {
  const { name, category, type, amount, description } = req.body;

  if (!name || !type || amount === undefined) {
    return res.status(400).json({ error: '资产名称、类型和金额不能为空' });
  }

  const db = loadDB();

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
  saveDB(db);

  res.json({ message: '添加成功', id: asset.id });
});

// 更新资产
app.put('/api/assets/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const { name, category, type, amount, description } = req.body;

  const db = loadDB();
  const idx = db.assets.findIndex(a => a.id === id && a.user_id === req.userId);

  if (idx === -1) {
    return res.status(404).json({ error: '资产不存在' });
  }

  db.assets[idx] = {
    ...db.assets[idx],
    name,
    category: category || '',
    type,
    amount: Number(amount),
    description: description || '',
    updated_at: new Date().toISOString()
  };

  saveDB(db);
  res.json({ message: '更新成功' });
});

// 删除资产
app.delete('/api/assets/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);

  const db = loadDB();
  const idx = db.assets.findIndex(a => a.id === id && a.user_id === req.userId);

  if (idx === -1) {
    return res.status(404).json({ error: '资产不存在' });
  }

  db.assets.splice(idx, 1);
  saveDB(db);

  res.json({ message: '删除成功' });
});

// ============ 统计接口 ============

// 资产统计
app.get('/api/statistics', authMiddleware, (req, res) => {
  const db = loadDB();
  const userAssets = db.assets.filter(a => a.user_id === req.userId);

  const total = userAssets.reduce((sum, a) => sum + a.amount, 0);
  const count = userAssets.length;

  const byTypeMap = {};
  userAssets.forEach(a => {
    if (!byTypeMap[a.type]) {
      byTypeMap[a.type] = { type: a.type, amount: 0, count: 0 };
    }
    byTypeMap[a.type].amount += a.amount;
    byTypeMap[a.type].count++;
  });

  const byType = Object.values(byTypeMap);

  res.json({ total, count, byType });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
