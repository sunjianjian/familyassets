const path = require('path');
const express = require('express');

// 设置存储为 JSON 文件存储
const storage = require('./src/storage');
storage.setStorage(require('./src/storage/jsonStorage'));

// 创建应用
const { createApp } = require('./src/app');
const app = createApp();

// 本地环境：托管静态文件
app.use(express.static(path.join(__dirname, 'public')));

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
