// 设置存储为 Vercel KV
const storage = require('../src/storage');
storage.setStorage(require('../src/storage/kvStorage'));

// 创建应用
const { createApp } = require('../src/app');
const app = createApp();

module.exports = app;
