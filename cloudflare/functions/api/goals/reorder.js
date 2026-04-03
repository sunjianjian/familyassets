// /api/goals/reorder - POST
import { getDB, saveDB, getUserId, jsonResponse } from '../_utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const userId = await getUserId(request);
  if (!userId) return jsonResponse({ error: '未授权' }, 401);

  try {
    const { ids } = await request.json();
    if (!Array.isArray(ids)) return jsonResponse({ error: '参数错误' }, 400);

    const db = await getDB(env);
    if (!db.goals) db.goals = [];

    // 按 ids 顺序重排该用户的目标，其余目标保持不变
    const userGoals = db.goals.filter(g => g.user_id === userId);
    const otherGoals = db.goals.filter(g => g.user_id !== userId);

    const reordered = ids
      .map(id => userGoals.find(g => g.id === id))
      .filter(Boolean);

    db.goals = [...otherGoals, ...reordered];
    await saveDB(env, db);
    return jsonResponse({ message: 'ok' });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
