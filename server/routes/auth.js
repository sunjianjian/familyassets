const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB, saveDB } = require('../storage');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// 用户注册
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度至少6位' });
    }

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
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const db = await getDB();
    const user = db.users.find(u => u.username === username);

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: '登录成功', token, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: '登录失败: ' + err.message });
  }
});

module.exports = router;
