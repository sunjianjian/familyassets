const { kv } = require('@vercel/kv');

const defaultData = { users: [], assets: [], nextUserId: 1, nextAssetId: 1 };

async function getDB() {
  const data = await kv.get('familyassets:db');
  return data || { ...defaultData };
}

async function saveDB(data) {
  await kv.set('familyassets:db', data);
}

module.exports = { getDB, saveDB };
