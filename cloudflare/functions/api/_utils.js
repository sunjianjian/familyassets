// 共享工具函数

const JWT_SECRET = 'familyassets_jwt_secret_2024';

// 简单的 Base64 编码/解码
function base64UrlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

// 简单的 JWT 实现
export async function signJwt(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  
  const encoder = new TextEncoder();
  const data = encoder.encode(`${headerB64}.${payloadB64}`);
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, data);
  const signatureB64 = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
  
  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

export async function verifyJwt(token) {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    
    const encoder = new TextEncoder();
    const data = encoder.encode(`${headerB64}.${payloadB64}`);
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const signature = Uint8Array.from(base64UrlDecode(signatureB64), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, signature, data);
    
    if (!valid) return null;
    
    return JSON.parse(base64UrlDecode(payloadB64));
  } catch {
    return null;
  }
}

// 简单的密码哈希（使用 SHA-256）
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + JWT_SECRET);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password, hash) {
  const computed = await hashPassword(password);
  return computed === hash;
}

// 从请求中获取用户 ID
export async function getUserId(request) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  
  const token = auth.slice(7);
  const payload = await verifyJwt(token);
  return payload?.userId || null;
}

// 默认资产类别（用户首次访问时初始化到数据库中）
export const DEFAULT_CATEGORIES = [
  { name: '现金', color: '#22c55e', isLiability: false, subs: ['活期存款', '货币基金', '其他'] },
  { name: '固收', color: '#3b82f6', isLiability: false, subs: ['定期存款', '银行理财', '住房公积金', '养老个人账户', '医保个人账户', 'P2P', '其他'] },
  { name: '权益', color: '#f59e0b', isLiability: false, subs: ['股票', '基金', '其他'] },
  { name: '另类', color: '#a855f7', isLiability: false, subs: ['期权', '其他'] },
  { name: '负债', color: '#ef4444', isLiability: true, subs: ['信用卡', '花呗', '其他'] }
];

// 获取数据库
export async function getDB(env) {
  const data = await env.FAMILYASSETS_KV.get('db', 'json');
  return data || {
    users: [], assets: [], goals: [], categories: [],
    nextUserId: 1, nextAssetId: 1, nextGoalId: 1, nextCategoryId: 1
  };
}

// 获取用户资产类别；首次访问时写入默认类别
export async function getUserCategories(env, db, userId) {
  if (!Array.isArray(db.categories)) db.categories = [];
  if (!db.nextCategoryId) db.nextCategoryId = 1;

  let cats = db.categories.filter(c => c.user_id === userId);
  if (cats.length === 0) {
    cats = DEFAULT_CATEGORIES.map((c, i) => ({
      id: db.nextCategoryId++,
      user_id: userId,
      name: c.name,
      color: c.color,
      isLiability: c.isLiability,
      subs: [...c.subs],
      sort: i
    }));
    db.categories.push(...cats);
    await saveDB(env, db);
  }
  return cats.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
}

// 保存数据库
export async function saveDB(env, db) {
  await env.FAMILYASSETS_KV.put('db', JSON.stringify(db));
}

// 规范化子类列表：去空格、去空值、去重
export function normalizeSubs(subs) {
  if (!Array.isArray(subs)) return [];
  const seen = new Set();
  const result = [];
  for (const raw of subs) {
    const value = String(raw ?? '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

// JSON 响应
export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
