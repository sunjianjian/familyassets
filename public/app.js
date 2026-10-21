// API 配置
const API_BASE = '/api';

// 默认资产类别（接口未返回时兜底）
const DEFAULT_CATEGORIES = [
  { name: '现金', color: '#22c55e', isLiability: false, subs: ['活期存款', '货币基金', '其他'] },
  { name: '固收', color: '#3b82f6', isLiability: false, subs: ['定期存款', '银行理财', '住房公积金', '养老个人账户', '医保个人账户', 'P2P', '其他'] },
  { name: '权益', color: '#f59e0b', isLiability: false, subs: ['股票', '基金', '其他'] },
  { name: '另类', color: '#a855f7', isLiability: false, subs: ['期权', '其他'] },
  { name: '负债', color: '#ef4444', isLiability: true, subs: ['信用卡', '花呗', '其他'] }
];

// 未知类别的兜底颜色
const FALLBACK_COLORS = ['#6366f1', '#14b8a6', '#ec4899', '#8b5cf6', '#0ea5e9', '#f97316', '#84cc16'];

let allAssets   = [];
let allGoals    = [];
let assetCategories = [];

// 状态管理
let token = localStorage.getItem('token');
let currentUser = localStorage.getItem('username');

// DOM 元素
const authPage        = document.getElementById('auth-page');
const mainPage        = document.getElementById('main-page');
const loginForm       = document.getElementById('login-form');
const registerForm    = document.getElementById('register-form');
const authError       = document.getElementById('auth-error');
const currentUserSpan = document.getElementById('current-user');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  if (token) showMainPage();
  initEventListeners();
});

// ── 带鉴权的 fetch 封装 ──────────────────────────────
async function authFetch(url, options = {}) {
  const headers = { 'Authorization': `Bearer ${token}`, ...options.headers };
  if (options.body) headers['Content-Type'] = 'application/json';
  return fetch(url, { ...options, headers });
}

// ── 事件监听器 ────────────────────────────────────────
function initEventListeners() {
  // 登录/注册切换
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (tab.dataset.tab === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
      } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
      }
      authError.textContent = '';
    });
  });

  // 登录
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      token = data.token;
      currentUser = data.username;
      localStorage.setItem('token', token);
      localStorage.setItem('username', currentUser);
      showMainPage();
    } catch (err) {
      authError.style.color = 'var(--danger)';
      authError.textContent = err.message;
    }
  });

  // 注册
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const confirm  = document.getElementById('register-confirm').value;
    if (password !== confirm) {
      authError.style.color = 'var(--danger)';
      authError.textContent = '两次密码输入不一致';
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      authError.style.color = 'var(--success)';
      authError.textContent = '注册成功，请登录';
      document.querySelector('[data-tab="login"]').click();
    } catch (err) {
      authError.style.color = 'var(--danger)';
      authError.textContent = err.message;
    }
  });

  // 退出登录
  document.getElementById('logout-btn').addEventListener('click', () => {
    token = null;
    currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    authPage.classList.remove('hidden');
    mainPage.classList.add('hidden');
    loginForm.reset();
    registerForm.reset();
  });

  // 导航切换
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
      document.getElementById(`${btn.dataset.view}-view`).classList.remove('hidden');
      if (btn.dataset.view === 'dashboard') loadDashboard();
      if (btn.dataset.view === 'assets')    loadAssets();
      if (btn.dataset.view === 'goals')     loadGoals();
      if (btn.dataset.view === 'categories') loadCategoriesView();
    });
  });

  // 资产类型联动
  document.getElementById('asset-category').addEventListener('change', (e) => {
    populateSubtypes(document.getElementById('asset-type'), e.target.value);
  });

  // 添加资产按钮
  document.getElementById('add-asset-btn').addEventListener('click', () => openAssetModal());

  // 类别管理
  document.getElementById('add-category-btn').addEventListener('click', () => openCategoryModal());
  document.getElementById('category-cancel-btn').addEventListener('click', () => closeCategoryModal());
  document.getElementById('add-subtype-btn').addEventListener('click', () => appendSubtypeRow(''));
  document.getElementById('category-form').addEventListener('submit', saveCategory);
  document.getElementById('categories-list').addEventListener('click', handleCategoryListClick);

  // 取消按钮
  document.getElementById('cancel-btn').addEventListener('click', () => closeAssetModal());

  // 资产表单提交
  document.getElementById('asset-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id   = document.getElementById('asset-id').value;
    const data = {
      name:           document.getElementById('asset-name').value,
      category:       document.getElementById('asset-category').value,
      type:           document.getElementById('asset-type').value,
      amount:         parseFloat(document.getElementById('asset-amount').value),
      principal:      parseFloat(document.getElementById('asset-principal').value) || null,
      expectedReturn: parseFloat(document.getElementById('asset-expected-return').value) || 0,
      description:    document.getElementById('asset-description').value
    };
    try {
      const res = await authFetch(
        id ? `${API_BASE}/assets/${id}` : `${API_BASE}/assets`,
        { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) }
      );
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      closeAssetModal();
      loadAssets();
      loadDashboard();
    } catch (err) {
      alert(err.message);
    }
  });

  // 添加目标按钮
  document.getElementById('add-goal-btn').addEventListener('click', () => openGoalModal());

  // 目标取消按钮
  document.getElementById('goal-cancel-btn').addEventListener('click', () => closeGoalModal());

  // 目标表单提交
  document.getElementById('goal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id   = document.getElementById('goal-id').value;
    const data = {
      name:        document.getElementById('goal-name').value,
      amount:      parseFloat(document.getElementById('goal-amount').value),
      description: document.getElementById('goal-description').value
    };
    try {
      const res = await authFetch(
        id ? `${API_BASE}/goals/${id}` : `${API_BASE}/goals`,
        { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) }
      );
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      closeGoalModal();
      loadGoals();
    } catch (err) {
      alert(err.message);
    }
  });
}

// ── 工具函数 ─────────────────────────────────────────
function formatNumber(num) {
  return Math.round(Number(num));
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeColor(color) {
  return /^#[0-9a-fA-F]{3,8}$/.test(String(color || '')) ? color : null;
}

// ── 资产类别配置 ─────────────────────────────────────
function normalizeDefaultCategories() {
  return DEFAULT_CATEGORIES.map((c, i) => ({ ...c, subs: [...c.subs], id: `default-${i}`, sort: i }));
}

async function loadCategories() {
  try {
    const res = await authFetch(`${API_BASE}/categories`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    assetCategories = Array.isArray(data) && data.length > 0 ? data : normalizeDefaultCategories();
  } catch (err) {
    console.error('加载类别失败:', err);
    if (assetCategories.length === 0) assetCategories = normalizeDefaultCategories();
  }
  renderAssetCategoryOptions();
  return assetCategories;
}

function getCategoryConfig(name) {
  return assetCategories.find(c => c.name === name);
}

function getCategoryColor(name) {
  const cfg = getCategoryConfig(name);
  const configured = cfg && safeColor(cfg.color);
  if (configured) return configured;
  const index = [...String(name)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % FALLBACK_COLORS.length;
  return FALLBACK_COLORS[index];
}

function getCategoryOrder(name) {
  const index = assetCategories.findIndex(c => c.name === name);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function isLiabilityCategory(name) {
  const cfg = getCategoryConfig(name);
  return cfg ? !!cfg.isLiability : name === '负债';
}

function getSubtypes(name) {
  const cfg = getCategoryConfig(name);
  return cfg && Array.isArray(cfg.subs) ? cfg.subs : [];
}

// 填充资产弹窗中的类别下拉框
function renderAssetCategoryOptions(selected = '') {
  const select = document.getElementById('asset-category');
  if (!select) return;
  const names = assetCategories.map(c => c.name);
  if (selected && !names.includes(selected)) names.push(selected);
  select.innerHTML = '<option value="">请选择类型</option>' +
    names.map(n => `<option value="${escapeAttr(n)}">${escapeHtml(n)}</option>`).join('');
  select.value = selected;
}

// 填充子类 <select>，保留已有值（即使已被删除）
function populateSubtypes(typeSelect, category, selected = '') {
  const subs = getSubtypes(category);
  if (selected && !subs.includes(selected)) subs.push(selected);
  typeSelect.innerHTML = '<option value="">请选择子类</option>' +
    subs.map(s => `<option value="${escapeAttr(s)}">${escapeHtml(s)}</option>`).join('');
  typeSelect.value = selected;
}

// ── 主页面 ───────────────────────────────────────────
function showMainPage() {
  authPage.classList.add('hidden');
  mainPage.classList.remove('hidden');
  currentUserSpan.textContent = currentUser;
  loadCategories().then(() => loadDashboard());
}

// ── 总览 ─────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [assetsRes, goalsRes] = await Promise.all([
      authFetch(`${API_BASE}/assets`),
      authFetch(`${API_BASE}/goals`)
    ]);
    const assets = await assetsRes.json();
    const goals  = await goalsRes.json();
    allAssets = assets;
    allGoals  = goals;

    // 净资产
    const totalAssets      = assets.filter(a => !isLiabilityCategory(a.category)).reduce((s, a) => s + a.amount, 0);
    const totalLiabilities = assets.filter(a => isLiabilityCategory(a.category)).reduce((s, a) => s + a.amount, 0);
    const netWorth = totalAssets - totalLiabilities;

    // 预期年收益
    const nonLiability = assets.filter(a => !isLiabilityCategory(a.category));
    const expectedAnnualReturn = nonLiability.reduce((sum, a) => {
      const principal = a.principal || a.amount;
      return sum + principal * (a.expectedReturn || 0) / 100;
    }, 0);

    document.getElementById('total-assets').textContent    = `¥${formatNumber(netWorth)}`;
    document.getElementById('net-annual-return').textContent = `年收益 ¥${formatNumber(expectedAnnualReturn)}`;

    renderCategoryPieChart(assets);
    renderGoalProgress(goals, netWorth);

    // 分类资产列表
    const categoryMap = {};
    assets.forEach(asset => {
      const cat  = asset.category;
      const type = asset.type;
      if (!categoryMap[cat]) categoryMap[cat] = { totalAmount: 0, groups: {} };
      categoryMap[cat].totalAmount += asset.amount;
      if (!categoryMap[cat].groups[type]) {
        categoryMap[cat].groups[type] = { totalAmount: 0, totalPrincipal: 0, totalExpectedReturn: 0 };
      }
      const g = categoryMap[cat].groups[type];
      g.totalAmount += asset.amount;
      const principal = asset.principal || asset.amount;
      g.totalPrincipal      += principal;
      g.totalExpectedReturn += principal * (asset.expectedReturn || 0) / 100;
    });

    const recentList = document.getElementById('recent-list');
    if (Object.keys(categoryMap).length === 0) {
      recentList.innerHTML = '<div class="empty-message">暂无资产记录</div>';
      return;
    }

    let html = '';
    Object.keys(categoryMap)
      .sort((a, b) => getCategoryOrder(a) - getCategoryOrder(b))
      .forEach(cat => {
        const catData = categoryMap[cat];
        const color = getCategoryColor(cat);
        const isLiability = isLiabilityCategory(cat);
        const amtColor = isLiability ? 'var(--danger)' : 'var(--success)';

        html += `
          <div class="category-header">
            <span class="category-header-name" style="color:${color}">${escapeHtml(cat)}</span>
            <span class="category-header-amount" style="color:${amtColor}">
              ${isLiability ? '-' : ''}¥${formatNumber(catData.totalAmount)}
            </span>
          </div>
        `;
        Object.entries(catData.groups)
          .sort((a, b) => b[1].totalAmount - a[1].totalAmount)
          .forEach(([type, g]) => {
            const avgRate = g.totalPrincipal > 0 ? g.totalExpectedReturn / g.totalPrincipal * 100 : 0;
            html += `
              <div class="asset-item asset-item-sub">
                <div class="asset-info">
                  <h4>${escapeHtml(type)}${avgRate > 0.001
                    ? `<small class="inline-rate">年化${avgRate.toFixed(2)}%</small>`
                    : ''}</h4>
                </div>
                <div class="asset-amount" style="color:${amtColor}">
                  ${isLiability ? '-' : ''}¥${formatNumber(g.totalAmount)}
                </div>
              </div>
            `;
          });
      });
    recentList.innerHTML = html;
  } catch (err) {
    console.error('加载概览失败:', err);
  }
}

// ── 目标达成率 ───────────────────────────────────────
function renderGoalProgress(goals, netWorth) {
  const section = document.getElementById('goal-progress-section');
  const listEl  = document.getElementById('goal-progress-list');

  if (!goals || goals.length === 0) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');

  let remaining = netWorth;
  listEl.innerHTML = goals.map(goal => {
    const pct        = goal.amount > 0 ? Math.min(remaining / goal.amount, 1) : 1;
    const pctDisplay = Math.round(pct * 100);
    remaining = Math.max(remaining - goal.amount, 0);
    const barColor = pct >= 1 ? 'var(--success)' : pct >= 0.5 ? 'var(--accent)' : 'var(--warning)';
    return `
      <div class="goal-progress-item">
        <div class="goal-progress-header">
          <span class="goal-progress-name">${escapeHtml(goal.name)}</span>
          <span class="goal-progress-pct" style="color:${barColor}">${pctDisplay}%</span>
        </div>
        <div class="goal-progress-bar-bg">
          <div class="goal-progress-bar-fill" style="width:${pctDisplay}%;background:${barColor}"></div>
        </div>
        <div class="goal-progress-amount">目标 ¥${formatNumber(goal.amount)}</div>
      </div>
    `;
  }).join('');
}

// ── 饼图 ─────────────────────────────────────────────
function renderCategoryPieChart(assets) {
  const svg    = document.getElementById('category-pie');
  const legend = document.getElementById('category-legend');

  const categoryStats = {};
  assets.forEach(asset => {
    const cat = asset.category || '其他';
    categoryStats[cat] = (categoryStats[cat] || 0) + Math.abs(asset.amount);
  });

  const categories = Object.keys(categoryStats)
    .sort((a, b) => getCategoryOrder(a) - getCategoryOrder(b));
  const total = Object.values(categoryStats).reduce((a, b) => a + b, 0);

  if (total === 0) {
    svg.innerHTML = `
      <circle cx="50" cy="50" r="40" fill="var(--bg-secondary)" />
      <text x="50" y="50" class="pie-center-text" transform="rotate(90 50 50)">暂无数据</text>
    `;
    legend.innerHTML = '';
    return;
  }

  let paths = '';
  let currentAngle = 0;
  categories.forEach(category => {
    const value      = categoryStats[category];
    const percentage = value / total;
    const angle      = percentage * 360;
    const color      = getCategoryColor(category);
    const startAngle = currentAngle;
    const endAngle   = currentAngle + angle;
    const largeArc   = angle > 180 ? 1 : 0;
    const x1 = 50 + 40 * Math.cos(startAngle * Math.PI / 180);
    const y1 = 50 + 40 * Math.sin(startAngle * Math.PI / 180);
    const x2 = 50 + 40 * Math.cos(endAngle   * Math.PI / 180);
    const y2 = 50 + 40 * Math.sin(endAngle   * Math.PI / 180);
    if (percentage > 0.001) {
      paths += percentage >= 0.9999
        ? `<circle cx="50" cy="50" r="40" fill="${color}" class="pie-slice" />`
        : `<path class="pie-slice" d="M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${color}" />`;
    }
    currentAngle += angle;
  });
  paths += `<circle cx="50" cy="50" r="25" fill="var(--bg-card)" />`;
  svg.innerHTML = paths;

  legend.innerHTML = categories.map(category => {
    const value      = categoryStats[category];
    const percentage = ((value / total) * 100).toFixed(1);
    const color      = getCategoryColor(category);
    return `
      <div class="legend-item">
        <span class="legend-dot" style="background:${color}"></span>
        <span class="legend-text">${escapeHtml(category)}</span>
        <span class="legend-value">${percentage}%</span>
      </div>
    `;
  }).join('');
}

// ── 资产管理 ─────────────────────────────────────────
async function loadAssets() {
  try {
    const res    = await authFetch(`${API_BASE}/assets`);
    const assets = await res.json();
    allAssets = assets;

    const assetsList = document.getElementById('assets-list');
    if (assets.length === 0) {
      assetsList.innerHTML = '<div class="empty-message">暂无资产记录，点击"添加资产"开始记录</div>';
      return;
    }

    const sorted = [...assets].sort((a, b) => {
      const diff = getCategoryOrder(a.category) - getCategoryOrder(b.category);
      return diff !== 0 ? diff : b.amount - a.amount;
    });

    assetsList.innerHTML = sorted.map(asset => {
      const color       = getCategoryColor(asset.category);
      const isLiability = isLiabilityCategory(asset.category);
      const amtColor    = isLiability ? 'var(--danger)' : 'var(--success)';
      const returnRate  = asset.expectedReturn || 0;
      return `
        <div class="asset-item">
          <div class="asset-info">
            <h4>${escapeHtml(asset.name)}</h4>
            <span style="color:${color}">${escapeHtml(asset.category)} · ${escapeHtml(asset.type)}${returnRate > 0
              ? ` · 年化${returnRate}%` : ''}${asset.description
              ? ' · ' + escapeHtml(asset.description) : ''}</span>
          </div>
          <div class="asset-amount" style="color:${amtColor}">
            ${isLiability ? '-' : ''}¥${formatNumber(asset.amount)}
          </div>
          <div class="asset-actions">
            <button class="edit-btn"   onclick="editAsset(${asset.id})">编辑</button>
            <button class="delete-btn" onclick="deleteAsset(${asset.id})">删除</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('加载资产失败:', err);
  }
}

function openAssetModal(asset = null) {
  const modal          = document.getElementById('asset-modal');
  const title          = document.getElementById('modal-title');
  const categorySelect = document.getElementById('asset-category');
  const typeSelect     = document.getElementById('asset-type');

  if (asset) {
    title.textContent = '编辑资产';
    document.getElementById('asset-id').value              = asset.id;
    document.getElementById('asset-name').value            = asset.name;
    document.getElementById('asset-amount').value          = asset.amount;
    document.getElementById('asset-principal').value       = asset.principal || '';
    document.getElementById('asset-expected-return').value = asset.expectedReturn || 0;
    document.getElementById('asset-description').value     = asset.description || '';
    categorySelect.value = asset.category || '';
    renderAssetCategoryOptions(asset.category || '');
    populateSubtypes(typeSelect, asset.category, asset.type || '');
  } else {
    title.textContent = '添加资产';
    document.getElementById('asset-form').reset();
    document.getElementById('asset-id').value              = '';
    document.getElementById('asset-principal').value       = '';
    document.getElementById('asset-expected-return').value = '';
    renderAssetCategoryOptions('');
    typeSelect.innerHTML = '<option value="">请先选择类型</option>';
  }
  modal.classList.remove('hidden');
}

function closeAssetModal() {
  document.getElementById('asset-modal').classList.add('hidden');
}

function editAsset(id) {
  const asset = allAssets.find(a => a.id === id);
  if (asset) openAssetModal(asset);
}

async function deleteAsset(id) {
  if (!confirm('确定要删除这项资产吗？')) return;
  try {
    const res = await authFetch(`${API_BASE}/assets/${id}`, { method: 'DELETE' });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
    loadAssets();
    loadDashboard();
  } catch (err) {
    alert(err.message);
  }
}

// ── 目标管理 ─────────────────────────────────────────
async function loadGoals() {
  try {
    const res   = await authFetch(`${API_BASE}/goals`);
    const goals = await res.json();
    allGoals = goals;

    const list = document.getElementById('goals-list');
    if (goals.length === 0) {
      list.innerHTML = '<div class="empty-message">暂无目标，点击"添加目标"开始记录</div>';
      return;
    }
    list.innerHTML = goals.map(goal => `
      <div class="asset-item goal-item" draggable="true" data-id="${goal.id}">
        <div class="drag-handle" title="拖拽排序">⠿</div>
        <div class="asset-info">
          <h4>${escapeHtml(goal.name)}</h4>
          ${goal.description ? `<span>${escapeHtml(goal.description)}</span>` : ''}
        </div>
        <div class="asset-amount" style="color:var(--accent)">
          ¥${formatNumber(goal.amount)}
        </div>
        <div class="asset-actions">
          <button class="edit-btn"   onclick="editGoal(${goal.id})">编辑</button>
          <button class="delete-btn" onclick="deleteGoal(${goal.id})">删除</button>
        </div>
      </div>
    `).join('');
    initGoalDnD(list);
  } catch (err) {
    console.error('加载目标失败:', err);
  }
}

function initGoalDnD(list) {
  let dragSrc = null;

  async function saveOrder() {
    const newOrder = [...list.querySelectorAll('.goal-item')].map(el => parseInt(el.dataset.id));
    try {
      await authFetch(`${API_BASE}/goals/reorder`, {
        method: 'POST',
        body: JSON.stringify({ ids: newOrder })
      });
    } catch (err) {
      console.error('保存排序失败:', err);
    }
  }

  function clearDragState() {
    list.querySelectorAll('.goal-item').forEach(i => i.classList.remove('dragging', 'drag-over'));
    dragSrc = null;
  }

  function insertItem(src, target) {
    if (!src || !target || src === target) return;
    const items  = [...list.querySelectorAll('.goal-item')];
    const srcIdx = items.indexOf(src);
    const dstIdx = items.indexOf(target);
    if (srcIdx < dstIdx) target.after(src);
    else target.before(src);
  }

  list.querySelectorAll('.goal-item').forEach(item => {
    const handle = item.querySelector('.drag-handle');

    // 桌面端 DnD
    item.setAttribute('draggable', 'true');
    handle.addEventListener('mousedown', () => item.setAttribute('draggable', 'true'));

    item.addEventListener('dragstart', e => {
      dragSrc = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend',  () => clearDragState());
    item.addEventListener('dragover', e => {
      e.preventDefault();
      if (item !== dragSrc) {
        list.querySelectorAll('.goal-item').forEach(i => i.classList.remove('drag-over'));
        item.classList.add('drag-over');
      }
    });
    item.addEventListener('drop', async e => {
      e.preventDefault();
      if (!dragSrc || dragSrc === item) return;
      item.classList.remove('drag-over');
      insertItem(dragSrc, item);
      clearDragState();
      await saveOrder();
    });

    // 移动端 Touch DnD
    handle.addEventListener('contextmenu', e => e.preventDefault());

    handle.addEventListener('touchstart', e => {
      e.preventDefault();
      e.stopPropagation();
      dragSrc = item;
      item.classList.add('dragging');
    }, { passive: false });

    handle.addEventListener('touchmove', e => {
      e.preventDefault();
      if (!dragSrc) return;
      const touch = e.touches[0];
      dragSrc.style.pointerEvents = 'none';
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      dragSrc.style.pointerEvents = '';
      const target = el?.closest('.goal-item');
      list.querySelectorAll('.goal-item').forEach(i => i.classList.remove('drag-over'));
      if (target && target !== dragSrc) target.classList.add('drag-over');
    }, { passive: false });

    handle.addEventListener('touchend', async e => {
      e.preventDefault();
      if (!dragSrc) return;
      const touch = e.changedTouches[0];
      dragSrc.style.pointerEvents = 'none';
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      dragSrc.style.pointerEvents = '';
      const target = el?.closest('.goal-item');
      if (target && target !== dragSrc) {
        insertItem(dragSrc, target);
        await saveOrder();
      }
      clearDragState();
    }, { passive: false });
  });
}

function openGoalModal(goal = null) {
  const modal = document.getElementById('goal-modal');
  const title = document.getElementById('goal-modal-title');
  if (goal) {
    title.textContent = '编辑目标';
    document.getElementById('goal-id').value          = goal.id;
    document.getElementById('goal-name').value        = goal.name;
    document.getElementById('goal-amount').value      = goal.amount;
    document.getElementById('goal-description').value = goal.description || '';
  } else {
    title.textContent = '添加目标';
    document.getElementById('goal-form').reset();
    document.getElementById('goal-id').value = '';
  }
  modal.classList.remove('hidden');
}

function closeGoalModal() {
  document.getElementById('goal-modal').classList.add('hidden');
}

function editGoal(id) {
  const goal = allGoals.find(g => g.id === id);
  if (goal) openGoalModal(goal);
}

async function deleteGoal(id) {
  if (!confirm('确定要删除这个目标吗？')) return;
  try {
    const res = await authFetch(`${API_BASE}/goals/${id}`, { method: 'DELETE' });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
    loadGoals();
  } catch (err) {
    alert(err.message);
  }
}

// ── 类别管理 ─────────────────────────────────────────
async function loadCategoriesView() {
  await loadCategories();
  renderCategoriesList();
}

function renderCategoriesList() {
  const list = document.getElementById('categories-list');
  if (!assetCategories.length) {
    list.innerHTML = '<div class="empty-message">暂无类别，点击"添加类别"开始配置</div>';
    return;
  }

  list.innerHTML = assetCategories.map(cat => {
    const color = safeColor(cat.color) || getCategoryColor(cat.name);
    const subs  = Array.isArray(cat.subs) ? cat.subs : [];
    return `
      <div class="category-card">
        <div class="category-card-header">
          <div class="category-card-title">
            <span class="category-dot" style="background:${escapeAttr(color)}"></span>
            <span class="category-name">${escapeHtml(cat.name)}</span>
            ${cat.isLiability ? '<span class="category-badge">负债</span>' : ''}
          </div>
          <div class="asset-actions">
            <button class="edit-btn"   data-action="edit-category"   data-id="${cat.id}">编辑</button>
            <button class="delete-btn" data-action="delete-category" data-id="${cat.id}">删除</button>
          </div>
        </div>
        <div class="subtype-chips">
          ${subs.length
            ? subs.map(s => `<span class="subtype-chip">${escapeHtml(s)}</span>`).join('')
            : '<span class="subtype-empty">暂无子类</span>'}
        </div>
      </div>
    `;
  }).join('');
}

async function handleCategoryListClick(e) {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const cat = assetCategories.find(c => String(c.id) === btn.dataset.id);
  if (!cat) return;

  if (btn.dataset.action === 'edit-category') openCategoryModal(cat);
  if (btn.dataset.action === 'delete-category') await deleteCategory(cat);
}

function openCategoryModal(cat = null) {
  const title     = document.getElementById('category-modal-title');
  const container = document.getElementById('subtype-inputs');

  document.getElementById('category-form').reset();
  container.innerHTML = '';

  if (cat) {
    title.textContent = '编辑类别';
    document.getElementById('category-id').value    = cat.id;
    document.getElementById('category-name').value  = cat.name;
    document.getElementById('category-color').value = cat.color || '#6366f1';
    document.getElementById('category-liability').checked = !!cat.isLiability;
    (cat.subs || []).forEach(sub => appendSubtypeRow(sub));
  } else {
    title.textContent = '添加类别';
    document.getElementById('category-id').value    = '';
    document.getElementById('category-color').value = '#6366f1';
    document.getElementById('category-liability').checked = false;
  }

  if (!container.children.length) appendSubtypeRow('');
  document.getElementById('category-modal').classList.remove('hidden');
  document.getElementById('category-name').focus();
}

function closeCategoryModal() {
  document.getElementById('category-modal').classList.add('hidden');
}

function appendSubtypeRow(value = '') {
  const container = document.getElementById('subtype-inputs');
  const row = document.createElement('div');
  row.className = 'subtype-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'subtype-input';
  input.placeholder = '子类名称';
  input.value = value;
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      appendSubtypeRow('').querySelector('input').focus();
    }
  });

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'subtype-remove';
  remove.title = '删除该子类';
  remove.textContent = '×';
  remove.addEventListener('click', () => row.remove());

  row.append(input, remove);
  container.appendChild(row);
  return row;
}

async function saveCategory(e) {
  e.preventDefault();
  const id   = document.getElementById('category-id').value;
  const name = document.getElementById('category-name').value.trim();
  if (!name) return alert('类别名称不能为空');

  const subs = [...document.querySelectorAll('#subtype-inputs .subtype-input')]
    .map(input => input.value.trim())
    .filter(Boolean);
  if (!subs.length) return alert('请至少添加一个资产子类');

  const body = {
    name,
    color:       document.getElementById('category-color').value,
    isLiability: document.getElementById('category-liability').checked,
    subs
  };

  try {
    const res = await authFetch(
      id ? `${API_BASE}/categories/${id}` : `${API_BASE}/categories`,
      { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) }
    );
    if (!res.ok) { const err = await res.json(); throw new Error(err.error); }

    closeCategoryModal();
    await loadCategories();
    renderCategoriesList();
    loadDashboard();
    loadAssets();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteCategory(cat) {
  if (!confirm(`确定要删除类别「${cat.name}」吗？`)) return;
  try {
    const res = await authFetch(`${API_BASE}/categories/${cat.id}`, { method: 'DELETE' });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error); }

    await loadCategories();
    renderCategoriesList();
    loadDashboard();
    loadAssets();
  } catch (err) {
    alert(err.message);
  }
}
