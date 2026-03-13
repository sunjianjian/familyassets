// API 配置
const API_BASE = '/api';

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
      
      authError.style.color = '#27ae60';
      authError.textContent = '注册成功，请登录';
      document.querySelector('[data-tab="login"]').click();
    } catch (err) {
      authError.style.color = '#e74c3c';
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
      if (btn.dataset.view === 'statistics') loadStatistics();
    });
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
    const data = {
      name: document.getElementById('asset-name').value,
      type: document.getElementById('asset-type').value,
      amount: parseFloat(document.getElementById('asset-amount').value),
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
    
    document.getElementById('total-assets').textContent = `¥${formatNumber(stats.total)}`;
    document.getElementById('assets-count').textContent = stats.count;
    
    const recentList = document.getElementById('recent-list');
    if (assets.length === 0) {
      recentList.innerHTML = '<div class="empty-message">暂无资产记录</div>';
    } else {
      recentList.innerHTML = assets.slice(0, 5).map(asset => `
        <div class="asset-item">
          <div class="asset-info">
            <h4>${escapeHtml(asset.name)}</h4>
            <span>${asset.type}</span>
          </div>
          <div class="asset-amount">¥${formatNumber(asset.amount)}</div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('加载概览失败:', err);
  }
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
      assetsList.innerHTML = assets.map(asset => `
        <div class="asset-item">
          <div class="asset-info">
            <h4>${escapeHtml(asset.name)}</h4>
            <span>${asset.type} ${asset.description ? '· ' + escapeHtml(asset.description) : ''}</span>
          </div>
          <div class="asset-amount">¥${formatNumber(asset.amount)}</div>
          <div class="asset-actions">
            <button class="edit-btn" onclick="editAsset(${asset.id})">编辑</button>
            <button class="delete-btn" onclick="deleteAsset(${asset.id})">删除</button>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('加载资产失败:', err);
  }
}

// 加载统计
async function loadStatistics() {
  try {
    const res = await fetch(`${API_BASE}/statistics`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const stats = await res.json();
    
    const typeStats = document.getElementById('type-stats');
    if (stats.byType.length === 0) {
      typeStats.innerHTML = '<div class="empty-message">暂无数据</div>';
    } else {
      const maxAmount = Math.max(...stats.byType.map(t => t.amount));
      typeStats.innerHTML = stats.byType.map(item => {
        const percentage = maxAmount > 0 ? (item.amount / maxAmount * 100) : 0;
        return `
          <div class="type-item">
            <span class="type-label">${item.type}</span>
            <div class="type-bar">
              <div class="type-bar-fill" style="width: ${percentage}%"></div>
            </div>
            <span class="type-amount">¥${formatNumber(item.amount)}</span>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('加载统计失败:', err);
  }
}

// 打开资产弹窗
function openAssetModal(asset = null) {
  const modal = document.getElementById('asset-modal');
  const title = document.getElementById('modal-title');
  
  if (asset) {
    title.textContent = '编辑资产';
    document.getElementById('asset-id').value = asset.id;
    document.getElementById('asset-name').value = asset.name;
    document.getElementById('asset-type').value = asset.type;
    document.getElementById('asset-amount').value = asset.amount;
    document.getElementById('asset-description').value = asset.description || '';
  } else {
    title.textContent = '添加资产';
    document.getElementById('asset-form').reset();
    document.getElementById('asset-id').value = '';
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
  } catch (err) {
    alert(err.message);
  }
}

// 工具函数
function formatNumber(num) {
  return Number(num).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
