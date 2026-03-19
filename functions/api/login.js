// POST /api/login
import { getDB, hashPassword, verifyPassword, signJwt, jsonResponse } from './_utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const { username, password } = await request.json();
    
    if (!username || !password) {
      return jsonResponse({ error: '用户名和密码不能为空' }, 400);
    }
    
    const db = await getDB(env);
    const user = db.users.find(u => u.username === username);
    
    if (!user) {
      return jsonResponse({ error: '用户名或密码错误' }, 401);
    }
    
    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      return jsonResponse({ error: '用户名或密码错误' }, 401);
    }
    
    const token = await signJwt({ userId: user.id, username: user.username });
    
    return jsonResponse({
      message: '登录成功',
      token,
      user: { id: user.id, username: user.username }
    });
  } catch (err) {
    return jsonResponse({ error: '登录失败: ' + err.message }, 500);
  }
}
