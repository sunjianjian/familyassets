const express = require('express');
const { getDB, saveDB } = require('../storage');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// 获取资产列表
router.get('/', authMiddleware, async (req, res) => {
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
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, category, type, amount, principal, description, expectedReturn } = req.body;

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
      principal: Number(principal) || Number(amount),
      expectedReturn: Number(expectedReturn) || 0,
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
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, category, type, amount, principal, description, expectedReturn } = req.body;

    const db = await getDB();
    const idx = db.assets.findIndex(a => a.id === id && a.user_id === req.userId);

    if (idx === -1) {
      return res.status(404).json({ error: '资产不存在' });
    }

    const newAmount = Number(amount);
    db.assets[idx] = {
      ...db.assets[idx],
      name,
      category: category || '',
      type,
      amount: newAmount,
      principal: Number(principal) || newAmount,
      expectedReturn: Number(expectedReturn) || 0,
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
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const db = await getDB();
    const idx = db.assets.findIndex(a => a.id === id && a.user_id === req.userId);

    if (idx === -1) {
      return res.status(404).json({ error: '资产不存在' });
    }

    db.assets.splice(idx, 1);
    await saveDB(db);

    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 资产统计
router.get('/statistics', authMiddleware, async (req, res) => {
  try {
    const db = await getDB();
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
