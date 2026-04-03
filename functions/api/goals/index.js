// /api/goals - GET, POST
import { getDB, saveDB, getUserId, jsonResponse } from '../_utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const userId = await getUserId(request);
  if (!userId) return jsonResponse({ error: '未授权' }, 401);

  try {
    const db = await getDB(env);
    const userGoals = (db.goals || []).filter(g => g.user_id === userId);
    return jsonResponse(userGoals);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const userId = await getUserId(request);
  if (!userId) return jsonResponse({ error: '未授权' }, 401);

  try {
    const { name, amount, description } = await request.json();
    if (!name || amount === undefined) {
      return jsonResponse({ error: '请填写目标名称和金额' }, 400);
    }
    const db = await getDB(env);
    if (!db.goals) db.goals = [];
    if (!db.nextGoalId) db.nextGoalId = 1;

    const goal = {
      id: db.nextGoalId++,
      user_id: userId,
      name,
      amount: parseFloat(amount),
      description: description || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.goals.push(goal);
    await saveDB(env, db);
    return jsonResponse(goal, 201);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
