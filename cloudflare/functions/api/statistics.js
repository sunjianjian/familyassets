// /api/statistics - GET
import { getDB, getUserId, jsonResponse } from './_utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  
  const userId = await getUserId(request);
  if (!userId) {
    return jsonResponse({ error: '未授权' }, 401);
  }
  
  try {
    const db = await getDB(env);
    const userAssets = db.assets.filter(a => a.user_id === userId);
    
    // 计算总资产
    const total = userAssets.reduce((sum, a) => sum + a.amount, 0);
    
    // 按类型分组统计
    const byCategory = {};
    userAssets.forEach(asset => {
      if (!byCategory[asset.category]) {
        byCategory[asset.category] = 0;
      }
      byCategory[asset.category] += asset.amount;
    });
    
    // 按子类型分组统计
    const byType = {};
    userAssets.forEach(asset => {
      const key = `${asset.category}-${asset.type}`;
      if (!byType[key]) {
        byType[key] = { category: asset.category, type: asset.type, amount: 0 };
      }
      byType[key].amount += asset.amount;
    });
    
    return jsonResponse({
      total,
      count: userAssets.length,
      byCategory,
      byType: Object.values(byType)
    });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
