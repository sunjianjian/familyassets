// /api/goals/[id] - PUT, DELETE
import { getDB, saveDB, getUserId, jsonResponse } from '../_utils.js';

export async function onRequestPut(context) {
  const { request, env, params } = context;
  const goalId = parseInt(params.id);
  const userId = await getUserId(request);
  if (!userId) return jsonResponse({ error: '未授权' }, 401);

  try {
    const { name, amount, description } = await request.json();
    const db = await getDB(env);
    if (!db.goals) db.goals = [];

    const idx = db.goals.findIndex(g => g.id === goalId && g.user_id === userId);
    if (idx === -1) return jsonResponse({ error: '目标不存在' }, 404);

    db.goals[idx] = {
      ...db.goals[idx],
      name: name || db.goals[idx].name,
      amount: amount !== undefined ? parseFloat(amount) : db.goals[idx].amount,
      description: description !== undefined ? description : db.goals[idx].description,
      updated_at: new Date().toISOString()
    };
    await saveDB(env, db);
    return jsonResponse(db.goals[idx]);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const goalId = parseInt(params.id);
  const userId = await getUserId(request);
  if (!userId) return jsonResponse({ error: '未授权' }, 401);

  try {
    const db = await getDB(env);
    if (!db.goals) db.goals = [];

    const idx = db.goals.findIndex(g => g.id === goalId && g.user_id === userId);
    if (idx === -1) return jsonResponse({ error: '目标不存在' }, 404);

    db.goals.splice(idx, 1);
    await saveDB(env, db);
    return jsonResponse({ message: '删除成功' });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
