/**
 * GET /api/giveaway/winners
 * Public. Returns the past-winners leaderboard, most recent first.
 */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function kvGet(key) {
  const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
  const data = await res.json();
  if (!data || data.result == null) return null;
  try {
    return JSON.parse(data.result);
  } catch (e) {
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return res.status(500).json({ error: 'giveaway backend is not configured yet' });
  }

  try {
    const winners = (await kvGet('giveaway:winners')) || [];
    const sorted = winners.slice().sort((a, b) => b.endedAt - a.endedAt).slice(0, 25);
    return res.status(200).json({ winners: sorted });
  } catch (err) {
    return res.status(500).json({ error: 'failed to load winners' });
  }
};
