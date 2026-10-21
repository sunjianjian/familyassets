// /api/categories - GET, POST
import { getDB, saveDB, getUserId, getUserCategories, normalizeSubs, jsonResponse } from '../_utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  const userId = await getUserId(request);
  if (!userId) return jsonResponse({ error: '未授权' }, 401);

  try {
    const db = await getDB(env);
    const categories = await getUserCategories(env, db, userId);
    return jsonResponse(categories);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const userId = await getUserId(request);
  if (!userId) return jsonResponse({ error: '未授权' }, 401);

  try {
    const body = await request.json();
    const name = String(body.name ?? '').trim();

    if (!name) return jsonResponse({ error: '类别名称不能为空' }, 400);
    if (body.subs !== undefined && !Array.isArray(body.subs)) {
      return jsonResponse({ error: '子类格式不正确' }, 400);
    }
    const subs = normalizeSubs(body.subs);

    const db = await getDB(env);
    const categories = await getUserCategories(env, db, userId);

    if (categories.some(c => c.name === name)) {
      return jsonResponse({ error: '该类别已存在' }, 400);
    }

    const maxSort = categories.reduce((max, c) => Math.max(max, c.sort ?? 0), -1);
    const category = {
      id: db.nextCategoryId++,
      user_id: userId,
      name,
      color: body.color || '#6366f1',
      isLiability: !!body.isLiability,
      subs: subs,
      sort: maxSort + 1
    };

    db.categories.push(category);
    await saveDB(env, db);

    return jsonResponse(category, 201);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
