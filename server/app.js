const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'family-assets-secret-key-2024';
const DB_FILE = path.join(__dirname, 'database.sqlite');

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

let db;

// 保存数据库到文件
function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_FILE, buffer);
}

// 初始化数据库
async function initDB() {
  const SQL = await initSqlJs();
  
  // 尝试加载现有数据库
  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  
  // 创建表
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  
  saveDB();
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
  
  // 检查用户名是否存在
  const existing = db.exec('SELECT id FROM users WHERE username = ?', [username]);
  if (existing.length > 0 && existing[0].values.length > 0) {
    return res.status(400).json({ error: '用户名已存在' });
  }
  
  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
    saveDB();
    
    const result = db.exec('SELECT last_insert_rowid() as id');
    const userId = result[0].values[0][0];
    
    res.json({ message: '注册成功', userId });
  } catch (err) {
    res.status(500).json({ error: '注册失败' });
  }
});

// 用户登录
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  
  const result = db.exec('SELECT id, username, password FROM users WHERE username = ?', [username]);
  
  if (result.length === 0 || result[0].values.length === 0) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  
  const user = {
    id: result[0].values[0][0],
    username: result[0].values[0][1],
    password: result[0].values[0][2]
  };
  
  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ message: '登录成功', token, username: user.username });
});

// ============ 资产接口 ============

// 获取资产列表
app.get('/api/assets', authMiddleware, (req, res) => {
  const result = db.exec(
    'SELECT id, user_id, name, type, amount, description, created_at, updated_at FROM assets WHERE user_id = ? ORDER BY created_at DESC',
    [req.userId]
  );
  
  if (result.length === 0) {
    return res.json([]);
  }
  
  const assets = result[0].values.map(row => ({
    id: row[0],
    user_id: row[1],
    name: row[2],
    type: row[3],
    amount: row[4],
    description: row[5],
    created_at: row[6],
    updated_at: row[7]
  }));
  
  res.json(assets);
});

// 添加资产
app.post('/api/assets', authMiddleware, (req, res) => {
  const { name, type, amount, description } = req.body;
  
  if (!name || !type || amount === undefined) {
    return res.status(400).json({ error: '资产名称、类型和金额不能为空' });
  }
  
  db.run(
    'INSERT INTO assets (user_id, name, type, amount, description) VALUES (?, ?, ?, ?, ?)',
    [req.userId, name, type, amount, description || '']
  );
  saveDB();
  
  const result = db.exec('SELECT last_insert_rowid() as id');
  const id = result[0].values[0][0];
  
  res.json({ message: '添加成功', id });
});

// 更新资产
app.put('/api/assets/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { name, type, amount, description } = req.body;
  
  // 验证资产归属
  const check = db.exec('SELECT id FROM assets WHERE id = ? AND user_id = ?', [id, req.userId]);
  if (check.length === 0 || check[0].values.length === 0) {
    return res.status(404).json({ error: '资产不存在' });
  }
  
  db.run(
    'UPDATE assets SET name = ?, type = ?, amount = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, type, amount, description || '', id]
  );
  saveDB();
  
  res.json({ message: '更新成功' });
});

// 删除资产
app.delete('/api/assets/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  
  // 验证资产归属
  const check = db.exec('SELECT id FROM assets WHERE id = ? AND user_id = ?', [id, req.userId]);
  if (check.length === 0 || check[0].values.length === 0) {
    return res.status(404).json({ error: '资产不存在' });
  }
  
  db.run('DELETE FROM assets WHERE id = ?', [id]);
  saveDB();
  
  res.json({ message: '删除成功' });
});

// ============ 统计接口 ============

// 资产统计
app.get('/api/statistics', authMiddleware, (req, res) => {
  // 总资产
  const totalResult = db.exec(
    'SELECT COALESCE(SUM(amount), 0) as total FROM assets WHERE user_id = ?',
    [req.userId]
  );
  const total = totalResult.length > 0 ? totalResult[0].values[0][0] : 0;
  
  // 按类型统计
  const byTypeResult = db.exec(
    'SELECT type, SUM(amount) as amount, COUNT(*) as count FROM assets WHERE user_id = ? GROUP BY type',
    [req.userId]
  );
  const byType = byTypeResult.length > 0 
    ? byTypeResult[0].values.map(row => ({ type: row[0], amount: row[1], count: row[2] }))
    : [];
  
  // 资产数量
  const countResult = db.exec('SELECT COUNT(*) as count FROM assets WHERE user_id = ?', [req.userId]);
  const count = countResult.length > 0 ? countResult[0].values[0][0] : 0;
  
  res.json({ total, count, byType });
});

// 启动服务器
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('数据库初始化失败:', err);
});
