const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '../../data/database.json');
const DATA_DIR = path.dirname(DB_FILE);

const defaultData = { users: [], assets: [], nextUserId: 1, nextAssetId: 1 };

async function getDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('加载数据库失败:', err);
  }
  return { ...defaultData };
}

async function saveDB(data) {
  // 确保目录存在
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

module.exports = { getDB, saveDB };
