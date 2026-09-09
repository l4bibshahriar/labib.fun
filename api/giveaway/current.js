/**
 * GET /api/giveaway/current
 * Public. Returns the current giveaway's public-safe info:
 * prize, winner count, end time, live entry count, and — if the last
 * giveaway was just ended by the admin — the winner announcement.
 * Never returns entrant emails here (that's admin-only, see admin.js).
 *
 * Requires these two Vercel env vars (Project → Settings → Environment
 * Variables), from your free Upstash Redis database's REST API tab:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
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
    const current = await kvGet('giveaway:current');
    if (!current) {
      return res.status(200).json({ state: 'none' });
    }

    if (current.active) {
      const entries = (await kvGet(`giveaway:entries:${current.id}`)) || [];
      const expired = Date.now() > current.endsAt;
      return res.status(200).json({
        state: expired ? 'expired' : 'active',
        id: current.id,
        prize: current.prize,
        winnerCount: current.winnerCount,
        endsAt: current.endsAt,
        entryCount: entries.length
      });
    }

    // Most recently ended giveaway — show the winner announcement once.
    return res.status(200).json({
      state: 'ended',
      prize: current.prize,
      winnerName: current.winnerName || null
    });
  } catch (err) {
    return res.status(500).json({ error: 'failed to load giveaway state' });
  }
};
