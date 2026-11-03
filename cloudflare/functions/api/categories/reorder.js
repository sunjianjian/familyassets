// /api/categories/reorder - POST
import { getDB, saveDB, getUserId, getUserCategories, jsonResponse } from '../_utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  const userId = await getUserId(request);
  if (!userId) return jsonResponse({ error: '未授权' }, 401);

  try {
    const { ids } = await request.json();
    if (!Array.isArray(ids)) return jsonResponse({ error: '排序参数不正确' }, 400);

    const db = await getDB(env);
    const categories = await getUserCategories(env, db, userId);

    const idIndex = new Map(ids.map((id, index) => [parseInt(id), index]));
    categories.forEach((c, index) => {
      c.sort = idIndex.has(c.id) ? idIndex.get(c.id) : ids.length + index;
    });

    await saveDB(env, db);
    return jsonResponse(categories.sort((a, b) => a.sort - b.sort));
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
