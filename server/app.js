const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const assetsRoutes = require('./routes/assets');
const categoriesRoutes = require('./routes/categories');
const { getDB } = require('./storage');
const { authMiddleware } = require('./middleware/auth');

function createApp() {
  const app = express();

  // 中间件
  app.use(cors());
  app.use(express.json());

  // API 路由
  app.use('/api', authRoutes);
  app.use('/api/assets', assetsRoutes);
  app.use('/api/categories', categoriesRoutes);

  // 统计路由（兼容原有 /api/statistics 路径）
  app.get('/api/statistics', authMiddleware, async (req, res) => {
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

  return app;
}

module.exports = { createApp };
