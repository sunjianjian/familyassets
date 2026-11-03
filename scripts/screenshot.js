/**
 * 布局自动化截图与重叠检测脚本
 *
 * 用途：在修改 index.html / style.css 后，自动在多个视口尺寸下截图，
 *       并检测饼图与分类资产列表是否发生元素重叠。
 *
 * 使用：npm run screenshot
 * 输出：scripts/screenshots/*.png（供 AI read_file 读取进行视觉验证）
 *
 * 退出码：0 = 全部通过，1 = 存在重叠或异常
 */

'use strict';

const { chromium } = require('playwright');
const http         = require('http');
const fs           = require('fs');
const path         = require('path');

// ── 静态文件服务 ────────────────────────────────────────────────────────────

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

function startStaticServer(publicDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath  = req.url.split('?')[0];
      const filePath = path.join(publicDir, urlPath === '/' ? 'index.html' : urlPath);
      const ext      = path.extname(filePath).toLowerCase();

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain' });
        res.end(data);
      });
    });

    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
    server.on('error', reject);
  });
}

// ── Mock 数据（覆盖所有资产分类，确保饼图有内容渲染）────────────────────

const MOCK_ASSETS = [
  { id: '1', name: '工商银行活期', category: '现金',  amount: 50000,  expectedReturn: 1.5 },
  { id: '2', name: '余额宝',       category: '固收',  amount: 30000,  expectedReturn: 2.8 },
  { id: '3', name: '沪深300ETF',   category: '权益',  amount: 80000,  expectedReturn: 8.0 },
  { id: '4', name: '黄金ETF',      category: '另类',  amount: 20000,  expectedReturn: 3.0 },
  { id: '5', name: '招行房贷',     category: '负债',  amount: -200000, expectedReturn: 0  },
];

const MOCK_GOALS = [
  { id: 'g1', name: '退休储蓄', targetAmount: 1000000, currentAmount: 180000, deadline: '2040-01-01', order: 0 },
  { id: 'g2', name: '买车',     targetAmount: 200000,  currentAmount: 80000,  deadline: '2026-06-01', order: 1 },
];

// ── 视口配置 ────────────────────────────────────────────────────────────────

const VIEWPORTS = [
  { name: 'mobile-375',  width: 375,  height: 812  },
  { name: 'mobile-390',  width: 390,  height: 844  },
  { name: 'tablet-768',  width: 768,  height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 800 },
];

// ── 重叠检测：检查 .overview-pie 与右侧资产列表是否有交集 ──────

const OVERLAP_CHECKS = [
  {
    label:  '饼图 vs 分类资产列表',
    selA:   '.overview-pie',
    selB:   '.overview-asset-list',
  },
  {
    label:  '饼图 vs 目标进度区',
    selA:   '.overview-pie',
    selB:   '#overview-goals:not(.hidden)',
  },
];

async function checkOverlap(page, viewportName) {
  const results = [];

  for (const check of OVERLAP_CHECKS) {
    const result = await page.evaluate(({ selA, selB, label }) => {
      const elA = document.querySelector(selA);
      const elB = document.querySelector(selB);
      if (!elA) return { skip: true, reason: `找不到元素: ${selA}` };
      if (!elB) return { skip: true, reason: `找不到元素: ${selB}（可能隐藏）` };

      const boxA = elA.getBoundingClientRect();
      const boxB = elB.getBoundingClientRect();

      // 元素不可见则跳过
      if (boxA.width === 0 || boxA.height === 0) return { skip: true, reason: `${selA} 不可见` };
      if (boxB.width === 0 || boxB.height === 0) return { skip: true, reason: `${selB} 不可见` };

      const overlap = !(
        boxA.right  <= boxB.left  ||
        boxB.right  <= boxA.left  ||
        boxA.bottom <= boxB.top   ||
        boxB.bottom <= boxA.top
      );

      return {
        overlap,
        boxA: { top: boxA.top, right: boxA.right, bottom: boxA.bottom, left: boxA.left },
        boxB: { top: boxB.top, right: boxB.right, bottom: boxB.bottom, left: boxB.left },
      };
    }, { selA: check.selA, selB: check.selB, label: check.label });

    if (result.skip) {
      console.log(`  [SKIP] ${check.label}: ${result.reason}`);
    } else if (result.overlap) {
      const msg = `[FAIL] ${viewportName} - ${check.label} 发生重叠`;
      console.error(`  ${msg}`);
      console.error(`         A: top=${result.boxA.top.toFixed(0)} right=${result.boxA.right.toFixed(0)} bottom=${result.boxA.bottom.toFixed(0)} left=${result.boxA.left.toFixed(0)}`);
      console.error(`         B: top=${result.boxB.top.toFixed(0)} right=${result.boxB.right.toFixed(0)} bottom=${result.boxB.bottom.toFixed(0)} left=${result.boxB.left.toFixed(0)}`);
      results.push(msg);
    } else {
      console.log(`  [PASS] ${check.label}`);
    }
  }

  return results;
}

// ── 主流程 ──────────────────────────────────────────────────────────────────

async function run() {
  const publicDir      = path.join(__dirname, '../public');
  const screenshotsDir = path.join(__dirname, 'screenshots');

  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const { server, port } = await startStaticServer(publicDir);
  console.log(`静态服务器启动于 http://127.0.0.1:${port}`);

  const browser    = await chromium.launch();
  const allErrors  = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n▶ ${vp.name} (${vp.width}×${vp.height})`);

    const page = await browser.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });

    // 注入 localStorage token，使 DOMContentLoaded 后自动进入主页
    await page.addInitScript(() => {
      localStorage.setItem('token',    'mock-token-for-screenshot');
      localStorage.setItem('username', '截图测试');
    });

    // 拦截 API 请求，返回 Mock 数据
    await page.route('**/api/assets', route => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ASSETS) });
      } else {
        route.continue();
      }
    });

    await page.route('**/api/goals', route => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_GOALS) });
      } else {
        route.continue();
      }
    });

    // 捕获页面 JS 错误，避免静默失败
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'networkidle' });

    if (pageErrors.length > 0) {
      console.warn(`  [WARN] 页面 JS 错误: ${pageErrors.join('; ')}`);
    }

    // 等待饼图 SVG 渲染完成（path 元素出现表示数据已加载）
    try {
      await page.waitForSelector('#category-pie path', { timeout: 5000 });
    } catch {
      console.warn(`  [WARN] 饼图未在 5s 内渲染，可能无资产数据`);
    }

    // 截图
    const screenshotPath = path.join(screenshotsDir, `${vp.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`  [OK]   截图已保存: scripts/screenshots/${vp.name}.png`);

    // 重叠检测
    const errors = await checkOverlap(page, vp.name);
    allErrors.push(...errors);

    await page.close();
  }

  await browser.close();
  server.close();

  // ── 汇总结果 ──────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(50));
  if (allErrors.length > 0) {
    console.error(`布局验证失败（${allErrors.length} 个问题）：`);
    allErrors.forEach(e => console.error(`  • ${e}`));
    process.exit(1);
  } else {
    console.log('所有视口布局验证通过');
    console.log('截图保存在 scripts/screenshots/ 目录，可用 read_file 工具查看。');
  }
}

run().catch(err => {
  console.error('脚本异常退出:', err);
  process.exit(1);
});
