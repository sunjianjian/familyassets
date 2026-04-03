// 设置存储为 Vercel KV
const storage = require('../server/storage');
storage.setStorage(require('../server/storage/kvStorage'));

// 创建应用
const { createApp } = require('../server/app');
const app = createApp();

module.exports = app;
