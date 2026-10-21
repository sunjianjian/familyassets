// /api/categories/[id] - PUT, DELETE
import { getDB, saveDB, getUserId, getUserCategories, normalizeSubs, jsonResponse } from '../_utils.js';

export async function onRequestPut(context) {
  const { request, env, params } = context;
  const categoryId = parseInt(params.id);

  const userId = await getUserId(request);
  if (!userId) return jsonResponse({ error: '未授权' }, 401);

  try {
    const body = await request.json();
    const db = await getDB(env);
    const categories = await getUserCategories(env, db, userId);

    const category = categories.find(c => c.id === categoryId);
    if (!category) return jsonResponse({ error: '类别不存在' }, 404);

    if (body.subs !== undefined && !Array.isArray(body.subs)) {
      return jsonResponse({ error: '子类格式不正确' }, 400);
    }

    const oldName = category.name;
    const newName = body.name !== undefined ? String(body.name).trim() : oldName;

    if (!newName) return jsonResponse({ error: '类别名称不能为空' }, 400);
    if (newName !== oldName && categories.some(c => c.id !== categoryId && c.name === newName)) {
      return jsonResponse({ error: '该类别已存在' }, 400);
    }

    category.name = newName;
    if (body.color !== undefined) category.color = body.color || '#6366f1';
    if (body.isLiability !== undefined) category.isLiability = !!body.isLiability;
    if (body.subs !== undefined) category.subs = normalizeSubs(body.subs);

    // 类别重命名时同步更新已有资产，避免资产变成"孤立类别"
    if (newName !== oldName) {
      db.assets.forEach(a => {
        if (a.user_id === userId && a.category === oldName) a.category = newName;
      });
    }

    await saveDB(env, db);
    return jsonResponse(category);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const categoryId = parseInt(params.id);

  const userId = await getUserId(request);
  if (!userId) return jsonResponse({ error: '未授权' }, 401);

  try {
    const db = await getDB(env);
    const categories = await getUserCategories(env, db, userId);

    const category = categories.find(c => c.id === categoryId);
    if (!category) return jsonResponse({ error: '类别不存在' }, 404);

    const usedCount = db.assets.filter(a => a.user_id === userId && a.category === category.name).length;
    if (usedCount > 0) {
      return jsonResponse({ error: `该类别下还有 ${usedCount} 项资产，请先修改或删除这些资产` }, 400);
    }

    db.categories = db.categories.filter(c => !(c.id === categoryId && c.user_id === userId));
    await saveDB(env, db);

    return jsonResponse({ message: '删除成功' });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
