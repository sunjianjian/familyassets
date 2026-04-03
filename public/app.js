// API 配置
const API_BASE = '/api';

// 资产分类配置
const ASSET_CATEGORIES = {
  '现金': ['活期存款', '货币基金', '其他'],
  '固收': ['定期存款', '银行理财', '住房公积金', '养老个人账户', '医保个人账户', 'P2P', '其他'],
  '权益': ['股票', '基金', '其他'],
  '另类': ['期权', '其他'],
  '负债': ['信用卡', '花呗', '其他']
};

// 分类颜色
const CATEGORY_COLORS = {
  '现金': '#22c55e',
  '固收': '#3b82f6',
  '权益': '#f59e0b',
  '另类': '#a855f7',
  '负债': '#ef4444'
};

// 子类颜色（渐变色调）
const SUBTYPE_COLORS = [
  '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a', '#172554'
];

// 当前选中的分类（null 表示无选中）
let selectedCategory = null;
let allAssets = [];

// 状态管理
let token = localStorage.getItem('token');
let currentUser = localStorage.getItem('username');

// DOM 元素
const authPage = document.getElementById('auth-page');
const mainPage = document.getElementById('main-page');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authError = document.getElementById('auth-error');
const currentUserSpan = document.getElementById('current-user');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  if (token) {
    showMainPage();
  }
  initEventListeners();
});

// 事件监听器
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
      authError.textContent = err.message;
    }
  });

  // 注册
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;
    
    if (password !== confirm) {
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
      
      authError.style.color = '#22c55e';
      authError.textContent = '注册成功，请登录';
      document.querySelector('[data-tab="login"]').click();
    } catch (err) {
      authError.style.color = '#ef4444';
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
      if (btn.dataset.view === 'assets') loadAssets();
      if (btn.dataset.view === 'goals') loadGoals();
    });
  });

  // 资产类型联动
  document.getElementById('asset-category').addEventListener('change', (e) => {
    const category = e.target.value;
    const typeSelect = document.getElementById('asset-type');
    
    typeSelect.innerHTML = '<option value="">请选择子类</option>';
    
    if (category && ASSET_CATEGORIES[category]) {
      ASSET_CATEGORIES[category].forEach(subtype => {
        const option = document.createElement('option');
        option.value = subtype;
        option.textContent = subtype;
        typeSelect.appendChild(option);
      });
    }
  });

  // 添加资产按钮
  document.getElementById('add-asset-btn').addEventListener('click', () => {
    openAssetModal();
  });

  // 取消按钮
  document.getElementById('cancel-btn').addEventListener('click', () => {
    closeAssetModal();
  });

  // 资产表单提交
  document.getElementById('asset-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('asset-id').value;
    const category = document.getElementById('asset-category').value;
    const type = document.getElementById('asset-type').value;
    
    const data = {
      name: document.getElementById('asset-name').value,
      category: category,
      type: type,
      amount: parseFloat(document.getElementById('asset-amount').value),
      principal: parseFloat(document.getElementById('asset-principal').value) || null,
      expectedReturn: parseFloat(document.getElementById('asset-expected-return').value) || 0,
      description: document.getElementById('asset-description').value
    };
    
    try {
      const url = id ? `${API_BASE}/assets/${id}` : `${API_BASE}/assets`;
      const method = id ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      
      closeAssetModal();
      loadAssets();
      loadDashboard();
    } catch (err) {
      alert(err.message);
    }
  });

  // 添加目标按钮
  document.getElementById('add-goal-btn').addEventListener('click', () => {
    openGoalModal();
  });

  // 目标取消按钮
  document.getElementById('goal-cancel-btn').addEventListener('click', () => {
    closeGoalModal();
  });

  // 目标表单提交
  document.getElementById('goal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('goal-id').value;
    const data = {
      name: document.getElementById('goal-name').value,
      amount: parseFloat(document.getElementById('goal-amount').value),
      description: document.getElementById('goal-description').value
    };
    try {
      const url = id ? `${API_BASE}/goals/${id}` : `${API_BASE}/goals`;
      const method = id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      closeGoalModal();
      loadGoals();
    } catch (err) {
      alert(err.message);
    }
  });
}

// 显示主页面
function showMainPage() {
  authPage.classList.add('hidden');
  mainPage.classList.remove('hidden');
  currentUserSpan.textContent = currentUser;
  loadDashboard();
}

// 加载概览
async function loadDashboard() {
  try {
    const [statsRes, assetsRes] = await Promise.all([
      fetch(`${API_BASE}/statistics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }),
      fetch(`${API_BASE}/assets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
    ]);
    
    const stats = await statsRes.json();
    const assets = await assetsRes.json();
    allAssets = assets;
    
    // 计算净资产
    const totalAssets = assets.filter(a => a.category !== '负债').reduce((sum, a) => sum + a.amount, 0);
    const totalLiabilities = assets.filter(a => a.category === '负债').reduce((sum, a) => sum + a.amount, 0);
    const netWorth = totalAssets - totalLiabilities;

    // 计算预期年收益与加权平均年化率
    const nonLiabilityAssets = assets.filter(a => a.category !== '负债');
    const expectedAnnualReturn = nonLiabilityAssets.reduce((sum, a) => {
      const principal = a.principal || a.amount;
      return sum + principal * (a.expectedReturn || 0) / 100;
    }, 0);
    const totalPrincipal = nonLiabilityAssets.reduce((sum, a) => sum + (a.principal || a.amount), 0);
    const weightedAvgRate = totalPrincipal > 0 ? expectedAnnualReturn / totalPrincipal * 100 : 0;

    document.getElementById('total-assets').textContent = `¥${formatNumber(netWorth)}`;
    document.getElementById('net-annual-return').textContent = `年收益 ¥${formatNumber(expectedAnnualReturn)}`;
    
    // 渲染饼图
    renderCategoryPieChart(assets);
    
    // 按一级分类 → 二级子类汇总
    const categoryOrder = ['现金', '固收', '权益', '另类', '负债'];
    const categoryMap = {};
    assets.forEach(asset => {
      const cat = asset.category;
      const type = asset.type;
      if (!categoryMap[cat]) categoryMap[cat] = { totalAmount: 0, groups: {} };
      categoryMap[cat].totalAmount += asset.amount;
      if (!categoryMap[cat].groups[type]) {
        categoryMap[cat].groups[type] = { totalAmount: 0, totalPrincipal: 0, totalExpectedReturn: 0 };
      }
      const g = categoryMap[cat].groups[type];
      g.totalAmount += asset.amount;
      const principal = asset.principal || asset.amount;
      g.totalPrincipal += principal;
      g.totalExpectedReturn += principal * (asset.expectedReturn || 0) / 100;
    });

    const recentList = document.getElementById('recent-list');
    if (Object.keys(categoryMap).length === 0) {
      recentList.innerHTML = '<div class="empty-message">暂无资产记录</div>';
    } else {
      let html = '';
      categoryOrder.forEach(cat => {
        if (!categoryMap[cat]) return;
        const catData = categoryMap[cat];
        const color = CATEGORY_COLORS[cat] || '#6366f1';
        const isLiability = cat === '负债';

        // 一级分类标题行
        html += `
          <div class="category-header">
            <span class="category-header-name" style="color: ${color}">${cat}</span>
            <span class="category-header-amount" style="color: ${isLiability ? '#ef4444' : '#22c55e'}">
              ${isLiability ? '-' : ''}¥${formatNumber(catData.totalAmount)}
            </span>
          </div>
        `;

        // 二级子类，按金额降序
        Object.entries(catData.groups)
          .sort((a, b) => b[1].totalAmount - a[1].totalAmount)
          .forEach(([type, g]) => {
            const avgRate = g.totalPrincipal > 0 ? g.totalExpectedReturn / g.totalPrincipal * 100 : 0;
            html += `
              <div class="asset-item asset-item-sub">
                <div class="asset-info">
                  <h4>${escapeHtml(type)}${avgRate > 0.001 ? `<small class="inline-rate">年化${avgRate.toFixed(2)}%</small>` : ''}</h4>
                </div>
                <div class="asset-amount" style="color: ${isLiability ? '#ef4444' : '#22c55e'}">
                  ${isLiability ? '-' : ''}¥${formatNumber(g.totalAmount)}
                </div>
              </div>
            `;
          });
      });
      recentList.innerHTML = html;
    }
  } catch (err) {
    console.error('加载概览失败:', err);
  }
}

// 渲染一级资产饼图
function renderCategoryPieChart(assets) {
  const svg = document.getElementById('category-pie');
  const legend = document.getElementById('category-legend');
  
  // 按大类统计
  const categoryStats = {};
  assets.forEach(asset => {
    const cat = asset.category || '其他';
    if (!categoryStats[cat]) {
      categoryStats[cat] = 0;
    }
    categoryStats[cat] += Math.abs(asset.amount);
  });
  
  const categories = Object.keys(categoryStats);
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
  
  categories.forEach((category, index) => {
    const value = categoryStats[category];
    const percentage = value / total;
    const angle = percentage * 360;
    const color = CATEGORY_COLORS[category] || '#6366f1';
    
    // 计算扇形路径
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    const largeArc = angle > 180 ? 1 : 0;
    
    const x1 = 50 + 40 * Math.cos(startAngle * Math.PI / 180);
    const y1 = 50 + 40 * Math.sin(startAngle * Math.PI / 180);
    const x2 = 50 + 40 * Math.cos(endAngle * Math.PI / 180);
    const y2 = 50 + 40 * Math.sin(endAngle * Math.PI / 180);
    
    const isActive = category === selectedCategory;
    
    if (percentage > 0.001) {
      if (percentage >= 0.9999) {
        // 360° 圆弧起终点重合，SVG 无法渲染，改用 circle
        paths += `<circle cx="50" cy="50" r="40" fill="${color}" data-category="${category}" onclick="selectCategory('${category}')" class="pie-slice ${isActive ? 'active' : ''}" style="cursor:pointer" />`;
      } else {
        paths += `
          <path 
            class="pie-slice ${isActive ? 'active' : ''}" 
            d="M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z"
            fill="${color}"
            data-category="${category}"
            onclick="selectCategory('${category}')"
            style="color: ${color}"
          />
        `;
      }
    }
    
    currentAngle += angle;
  });
  
  // 中心圆
  paths += `<circle cx="50" cy="50" r="25" fill="var(--bg-card)" />`;
  
  svg.innerHTML = paths;
  
  // 渲染图例
  legend.innerHTML = categories.map(category => {
    const value = categoryStats[category];
    const percentage = ((value / total) * 100).toFixed(1);
    const color = CATEGORY_COLORS[category] || '#6366f1';
    const isActive = category === selectedCategory;
    return `
      <div class="legend-item ${isActive ? 'active' : ''}" onclick="selectCategory('${category}')">
        <span class="legend-dot" style="background: ${color}"></span>
        <span class="legend-text">${category}</span>
        <span class="legend-value">${percentage}%</span>
      </div>
    `;
  }).join('');
}

// 渲染二级资产饼图
function renderSubtypePieChart(assets, category) {
  const svg = document.getElementById('subtype-pie');
  const legend = document.getElementById('subtype-legend');
  const title = document.getElementById('subtype-title');
  
  title.textContent = `${category}明细`;
  
  // 筛选该分类下的资产
  const categoryAssets = assets.filter(a => a.category === category);
  
  // 按子类统计
  const subtypeStats = {};
  categoryAssets.forEach(asset => {
    const type = asset.type || '其他';
    if (!subtypeStats[type]) {
      subtypeStats[type] = 0;
    }
    subtypeStats[type] += Math.abs(asset.amount);
  });
  
  const subtypes = Object.keys(subtypeStats);
  const total = Object.values(subtypeStats).reduce((a, b) => a + b, 0);
  
  if (total === 0) {
    svg.innerHTML = `
      <circle cx="50" cy="50" r="40" fill="var(--bg-secondary)" />
      <text x="50" y="50" class="pie-center-text" transform="rotate(90 50 50)">暂无数据</text>
    `;
    legend.innerHTML = '<div class="empty-message" style="padding: 20px; font-size: 13px;">该分类暂无资产</div>';
    return;
  }
  
  // 基于分类颜色生成子类颜色
  const baseColor = CATEGORY_COLORS[category] || '#6366f1';
  const subtypeColors = generateColorShades(baseColor, subtypes.length);
  
  let paths = '';
  let currentAngle = 0;
  
  subtypes.forEach((subtype, index) => {
    const value = subtypeStats[subtype];
    const percentage = value / total;
    const angle = percentage * 360;
    const color = subtypeColors[index];
    
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    const largeArc = angle > 180 ? 1 : 0;
    
    const x1 = 50 + 40 * Math.cos(startAngle * Math.PI / 180);
    const y1 = 50 + 40 * Math.sin(startAngle * Math.PI / 180);
    const x2 = 50 + 40 * Math.cos(endAngle * Math.PI / 180);
    const y2 = 50 + 40 * Math.sin(endAngle * Math.PI / 180);
    
    if (percentage > 0.001) {
      if (percentage >= 0.9999) {
        // 360° 圆弧起终点重合，SVG 无法渲染，改用 circle
        paths += `<circle cx="50" cy="50" r="40" fill="${color}" class="pie-slice" />`;
      } else {
        paths += `
          <path 
            class="pie-slice" 
            d="M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z"
            fill="${color}"
          />
        `;
      }
    }
    
    currentAngle += angle;
  });
  
  // 中心圆
  paths += `<circle cx="50" cy="50" r="25" fill="var(--bg-card)" />`;
  
  svg.innerHTML = paths;
  
  // 渲染图例
  legend.innerHTML = subtypes.map((subtype, index) => {
    const value = subtypeStats[subtype];
    const percentage = ((value / total) * 100).toFixed(1);
    const color = subtypeColors[index];
    return `
      <div class="legend-item">
        <span class="legend-dot" style="background: ${color}"></span>
        <span class="legend-text">${subtype}</span>
        <span class="legend-value">${percentage}%</span>
      </div>
    `;
  }).join('');
}

// 选择分类（再次点击同一类则取消）
function selectCategory(category) {
  const card = document.getElementById('subtype-chart-card');
  if (selectedCategory === category) {
    selectedCategory = null;
    card.classList.add('hidden');
  } else {
    selectedCategory = category;
    card.classList.remove('hidden');
    renderSubtypePieChart(allAssets, category);
  }
  renderCategoryPieChart(allAssets);
}

// 生成颜色渐变
function generateColorShades(baseColor, count) {
  const colors = [];
  for (let i = 0; i < count; i++) {
    const lightness = 60 - (i * 10);
    const saturation = 70 + (i * 5);
    colors.push(adjustColor(baseColor, i, count));
  }
  return colors;
}

// 调整颜色亮度
function adjustColor(hex, index, total) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  
  const factor = 1 - (index * 0.15);
  const newR = Math.round(Math.min(255, r * factor + (255 - r * factor) * 0.3));
  const newG = Math.round(Math.min(255, g * factor + (255 - g * factor) * 0.3));
  const newB = Math.round(Math.min(255, b * factor + (255 - b * factor) * 0.3));
  
  return `rgb(${newR}, ${newG}, ${newB})`;
}

// 加载资产列表
async function loadAssets() {
  try {
    const res = await fetch(`${API_BASE}/assets`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const assets = await res.json();
    
    const assetsList = document.getElementById('assets-list');
    if (assets.length === 0) {
      assetsList.innerHTML = '<div class="empty-message">暂无资产记录，点击"添加资产"开始记录</div>';
    } else {
      const categoryOrder = ['现金', '固收', '权益', '另类', '负债'];
      const sorted = [...assets].sort((a, b) => {
        const orderA = categoryOrder.indexOf(a.category);
        const orderB = categoryOrder.indexOf(b.category);
        if (orderA !== orderB) return orderA - orderB;
        return b.amount - a.amount; // 同大类内按金额降序
      });
      assetsList.innerHTML = sorted.map(asset => {
        const color = CATEGORY_COLORS[asset.category] || '#6366f1';
        const isLiability = asset.category === '负债';
        const returnRate = asset.expectedReturn || 0;
        return `
          <div class="asset-item">
            <div class="asset-info">
              <h4>${escapeHtml(asset.name)}</h4>
              <span style="color: ${color}">${asset.category} · ${asset.type}${returnRate > 0 ? ` · 年化${returnRate}%` : ''}${asset.description ? ' · ' + escapeHtml(asset.description) : ''}</span>
            </div>
            <div class="asset-amount" style="color: ${isLiability ? '#ef4444' : '#22c55e'}">
              ${isLiability ? '-' : ''}¥${formatNumber(asset.amount)}
            </div>
            <div class="asset-actions">
              <button class="edit-btn" onclick="editAsset(${asset.id})">编辑</button>
              <button class="delete-btn" onclick="deleteAsset(${asset.id})">删除</button>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('加载资产失败:', err);
  }
}

// 打开资产弹窗
function openAssetModal(asset = null) {
  const modal = document.getElementById('asset-modal');
  const title = document.getElementById('modal-title');
  const categorySelect = document.getElementById('asset-category');
  const typeSelect = document.getElementById('asset-type');
  
  if (asset) {
    title.textContent = '编辑资产';
    document.getElementById('asset-id').value = asset.id;
    document.getElementById('asset-name').value = asset.name;
    document.getElementById('asset-amount').value = asset.amount;
    document.getElementById('asset-principal').value = asset.principal || '';
    document.getElementById('asset-expected-return').value = asset.expectedReturn || 0;
    document.getElementById('asset-description').value = asset.description || '';
    
    // 设置分类
    categorySelect.value = asset.category || '';
    
    // 更新子类选项
    typeSelect.innerHTML = '<option value="">请选择子类</option>';
    if (asset.category && ASSET_CATEGORIES[asset.category]) {
      ASSET_CATEGORIES[asset.category].forEach(subtype => {
        const option = document.createElement('option');
        option.value = subtype;
        option.textContent = subtype;
        typeSelect.appendChild(option);
      });
    }
    typeSelect.value = asset.type || '';
  } else {
    title.textContent = '添加资产';
    document.getElementById('asset-form').reset();
    document.getElementById('asset-id').value = '';
    document.getElementById('asset-principal').value = '';
    document.getElementById('asset-expected-return').value = '';
    categorySelect.value = '';
    typeSelect.innerHTML = '<option value="">请先选择类型</option>';
  }
  
  modal.classList.remove('hidden');
}

// 关闭资产弹窗
function closeAssetModal() {
  document.getElementById('asset-modal').classList.add('hidden');
}

// 编辑资产
async function editAsset(id) {
  try {
    const res = await fetch(`${API_BASE}/assets`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const assets = await res.json();
    const asset = assets.find(a => a.id === id);
    if (asset) {
      openAssetModal(asset);
    }
  } catch (err) {
    console.error('获取资产失败:', err);
  }
}

// 删除资产
async function deleteAsset(id) {
  if (!confirm('确定要删除这项资产吗？')) return;
  
  try {
    const res = await fetch(`${API_BASE}/assets/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }
    
    loadAssets();
    loadDashboard();
  } catch (err) {
    alert(err.message);
  }
}

// 工具函数
function formatNumber(num) {
  return Number(num).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── 目标管理 ──────────────────────────────────

async function loadGoals() {
  try {
    const res = await fetch(`${API_BASE}/goals`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const goals = await res.json();
    const list = document.getElementById('goals-list');
    if (goals.length === 0) {
      list.innerHTML = '<div class="empty-message">暂无目标，点击"添加目标"开始记录</div>';
    } else {
      list.innerHTML = goals.map(goal => `
        <div class="asset-item">
          <div class="asset-info">
            <h4>${escapeHtml(goal.name)}</h4>
            ${goal.description ? `<span>${escapeHtml(goal.description)}</span>` : ''}
          </div>
          <div class="asset-amount" style="color: var(--accent)">
            ¥${formatNumber(goal.amount)}
          </div>
          <div class="asset-actions">
            <button class="edit-btn" onclick="editGoal(${goal.id})">编辑</button>
            <button class="delete-btn" onclick="deleteGoal(${goal.id})">删除</button>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('加载目标失败:', err);
  }
}

function openGoalModal(goal = null) {
  const modal = document.getElementById('goal-modal');
  const title = document.getElementById('goal-modal-title');
  if (goal) {
    title.textContent = '编辑目标';
    document.getElementById('goal-id').value = goal.id;
    document.getElementById('goal-name').value = goal.name;
    document.getElementById('goal-amount').value = goal.amount;
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

async function editGoal(id) {
  try {
    const res = await fetch(`${API_BASE}/goals`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const goals = await res.json();
    const goal = goals.find(g => g.id === id);
    if (goal) openGoalModal(goal);
  } catch (err) {
    console.error('获取目标失败:', err);
  }
}

async function deleteGoal(id) {
  if (!confirm('确定要删除这个目标吗？')) return;
  try {
    const res = await fetch(`${API_BASE}/goals/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }
    loadGoals();
  } catch (err) {
    alert(err.message);
  }
}
