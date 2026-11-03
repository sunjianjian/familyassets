const express = require('express');
const { getDB, saveDB } = require('../storage');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// 与 cloudflare/functions/api/_utils.js 中的 DEFAULT_CATEGORIES 保持一致
const DEFAULT_CATEGORIES = [
  { name: '现金', color: '#22c55e', isLiability: false, subs: ['活期存款', '货币基金', '其他'] },
  { name: '固收', color: '#3b82f6', isLiability: false, subs: ['定期存款', '银行理财', '住房公积金', '养老个人账户', '医保个人账户', 'P2P', '其他'] },
  { name: '权益', color: '#f59e0b', isLiability: false, subs: ['股票', '基金', '其他'] },
  { name: '另类', color: '#a855f7', isLiability: false, subs: ['期权', '其他'] },
  { name: '负债', color: '#ef4444', isLiability: true, subs: ['信用卡', '花呗', '其他'] }
];

function normalizeSubs(subs) {
  if (!Array.isArray(subs)) return [];
  const seen = new Set();
  const result = [];
  for (const raw of subs) {
    const value = String(raw ?? '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

async function getUserCategories(db, userId) {
  if (!Array.isArray(db.categories)) db.categories = [];
  if (!db.nextCategoryId) db.nextCategoryId = 1;

  let cats = db.categories.filter(c => c.user_id === userId);
  if (cats.length === 0) {
    cats = DEFAULT_CATEGORIES.map((c, i) => ({
      id: db.nextCategoryId++,
      user_id: userId,
      name: c.name,
      color: c.color,
      isLiability: c.isLiability,
      subs: [...c.subs],
      sort: i
    }));
    db.categories.push(...cats);
    await saveDB(db);
  }
  return cats.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
}

// 获取类别列表
router.get('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDB();
    const categories = await getUserCategories(db, req.userId);
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 新增类别
router.post('/', authMiddleware, async (req, res) => {
  try {
    const body = req.body || {};
    const name = String(body.name ?? '').trim();
    if (!name) return res.status(400).json({ error: '类别名称不能为空' });
    if (body.subs !== undefined && !Array.isArray(body.subs)) {
      return res.status(400).json({ error: '子类格式不正确' });
    }

    const db = await getDB();
    const categories = await getUserCategories(db, req.userId);
    if (categories.some(c => c.name === name)) {
      return res.status(400).json({ error: '该类别已存在' });
    }

    const maxSort = categories.reduce((max, c) => Math.max(max, c.sort ?? 0), -1);
    const category = {
      id: db.nextCategoryId++,
      user_id: req.userId,
      name,
      color: body.color || '#6366f1',
      isLiability: !!body.isLiability,
      subs: normalizeSubs(body.subs),
      sort: maxSort + 1
    };

    db.categories.push(category);
    await saveDB(db);
    res.status(201).json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 类别排序（需放在 /:id 之前）
router.post('/reorder', authMiddleware, async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids)) return res.status(400).json({ error: '排序参数不正确' });

    const db = await getDB();
    const categories = await getUserCategories(db, req.userId);

    const idIndex = new Map(ids.map((id, index) => [parseInt(id), index]));
    categories.forEach((c, index) => {
      c.sort = idIndex.has(c.id) ? idIndex.get(c.id) : ids.length + index;
    });

    await saveDB(db);
    res.json(categories.sort((a, b) => a.sort - b.sort));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新类别
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body || {};
    if (body.subs !== undefined && !Array.isArray(body.subs)) {
      return res.status(400).json({ error: '子类格式不正确' });
    }

    const db = await getDB();
    const categories = await getUserCategories(db, req.userId);

    const category = categories.find(c => c.id === id);
    if (!category) return res.status(404).json({ error: '类别不存在' });

    const oldName = category.name;
    const newName = body.name !== undefined ? String(body.name).trim() : oldName;

    if (!newName) return res.status(400).json({ error: '类别名称不能为空' });
    if (newName !== oldName && categories.some(c => c.id !== id && c.name === newName)) {
      return res.status(400).json({ error: '该类别已存在' });
    }

    category.name = newName;
    if (body.color !== undefined) category.color = body.color || '#6366f1';
    if (body.isLiability !== undefined) category.isLiability = !!body.isLiability;
    if (body.subs !== undefined) category.subs = normalizeSubs(body.subs);

    if (newName !== oldName) {
      db.assets.forEach(a => {
        if (a.user_id === req.userId && a.category === oldName) a.category = newName;
      });
    }

    await saveDB(db);
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除类别
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const db = await getDB();
    const categories = await getUserCategories(db, req.userId);

    const category = categories.find(c => c.id === id);
    if (!category) return res.status(404).json({ error: '类别不存在' });

    const usedCount = db.assets.filter(a => a.user_id === req.userId && a.category === category.name).length;
    if (usedCount > 0) {
      return res.status(400).json({ error: `该类别下还有 ${usedCount} 项资产，请先修改或删除这些资产` });
    }

    db.categories = db.categories.filter(c => !(c.id === id && c.user_id === req.userId));
    await saveDB(db);
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
