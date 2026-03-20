// /api/assets - GET, POST
import { getDB, saveDB, getUserId, jsonResponse } from '../_utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  
  const userId = await getUserId(request);
  if (!userId) {
    return jsonResponse({ error: '未授权' }, 401);
  }
  
  try {
    const db = await getDB(env);
    const userAssets = db.assets.filter(a => a.user_id === userId);
    return jsonResponse(userAssets);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  
  const userId = await getUserId(request);
  if (!userId) {
    return jsonResponse({ error: '未授权' }, 401);
  }
  
  try {
    const { name, category, type, amount, principal, description, expectedReturn } = await request.json();
    
    if (!name || !category || !type || amount === undefined) {
      return jsonResponse({ error: '请填写完整信息' }, 400);
    }
    
    const db = await getDB(env);
    const amountNum = parseFloat(amount);
    
    const asset = {
      id: db.nextAssetId++,
      user_id: userId,
      name,
      category,
      type,
      amount: amountNum,
      principal: parseFloat(principal) || amountNum,
      expectedReturn: parseFloat(expectedReturn) || 0,
      description: description || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    db.assets.push(asset);
    await saveDB(env, db);
    
    return jsonResponse(asset, 201);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
