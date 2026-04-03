// POST /api/register
import { getDB, saveDB, hashPassword, jsonResponse } from './_utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const { username, password } = await request.json();
    
    if (!username || !password) {
      return jsonResponse({ error: '用户名和密码不能为空' }, 400);
    }
    
    if (password.length < 6) {
      return jsonResponse({ error: '密码至少6位' }, 400);
    }
    
    const db = await getDB(env);
    
    // 检查用户名是否已存在
    if (db.users.find(u => u.username === username)) {
      return jsonResponse({ error: '用户名已存在' }, 400);
    }
    
    // 创建新用户
    const hashedPassword = await hashPassword(password);
    const user = {
      id: db.nextUserId++,
      username,
      password: hashedPassword,
      created_at: new Date().toISOString()
    };
    
    db.users.push(user);
    await saveDB(env, db);
    
    return jsonResponse({ message: '注册成功', userId: user.id });
  } catch (err) {
    return jsonResponse({ error: '注册失败: ' + err.message }, 500);
  }
}
