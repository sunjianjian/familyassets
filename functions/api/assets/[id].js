// /api/assets/[id] - PUT, DELETE
import { getDB, saveDB, getUserId, jsonResponse } from '../_utils.js';

export async function onRequestPut(context) {
  const { request, env, params } = context;
  const assetId = parseInt(params.id);
  
  const userId = await getUserId(request);
  if (!userId) {
    return jsonResponse({ error: '未授权' }, 401);
  }
  
  try {
    const { name, category, type, amount, description } = await request.json();
    const db = await getDB(env);
    
    const assetIndex = db.assets.findIndex(a => a.id === assetId && a.user_id === userId);
    if (assetIndex === -1) {
      return jsonResponse({ error: '资产不存在' }, 404);
    }
    
    db.assets[assetIndex] = {
      ...db.assets[assetIndex],
      name: name || db.assets[assetIndex].name,
      category: category || db.assets[assetIndex].category,
      type: type || db.assets[assetIndex].type,
      amount: amount !== undefined ? parseFloat(amount) : db.assets[assetIndex].amount,
      description: description !== undefined ? description : db.assets[assetIndex].description,
      updated_at: new Date().toISOString()
    };
    
    await saveDB(env, db);
    return jsonResponse(db.assets[assetIndex]);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const assetId = parseInt(params.id);
  
  const userId = await getUserId(request);
  if (!userId) {
    return jsonResponse({ error: '未授权' }, 401);
  }
  
  try {
    const db = await getDB(env);
    
    const assetIndex = db.assets.findIndex(a => a.id === assetId && a.user_id === userId);
    if (assetIndex === -1) {
      return jsonResponse({ error: '资产不存在' }, 404);
    }
    
    db.assets.splice(assetIndex, 1);
    await saveDB(env, db);
    
    return jsonResponse({ message: '删除成功' });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
