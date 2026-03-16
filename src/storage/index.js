// 存储层接口 - 根据环境自动选择实现
// 通过 setStorage() 手动设置，或通过环境变量自动选择

let storage = null;

function setStorage(impl) {
  storage = impl;
}

function getStorage() {
  if (!storage) {
    // 根据环境变量自动选择
    if (process.env.VERCEL || process.env.KV_REST_API_URL) {
      storage = require('./kvStorage');
    } else {
      storage = require('./jsonStorage');
    }
  }
  return storage;
}

async function getDB() {
  return getStorage().getDB();
}

async function saveDB(data) {
  return getStorage().saveDB(data);
}

module.exports = { setStorage, getDB, saveDB };
