/**
 * POST /api/giveaway/admin
 * Body: { password, action, ...payload }
 *
 * The password is checked here, on the server, against the
 * GIVEAWAY_ADMIN_PASSWORD environment variable — it is never present
 * in any file that ships to the browser, so it can't be read from
 * dev tools or view-source no matter how public the GitHub repo is.
 * Set it in Vercel → Project → Settings → Environment Variables.
 *
 * actions:
 *   create  { prize, winnerCount, endsInHours }  -> starts a new giveaway
 *   list    {}                                    -> full entries (with emails)
 *   remove  { email }                              -> removes one entry
 *   end     { winnerEmail }                        -> ends giveaway, records winner
 */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const ADMIN_PASSWORD = process.env.GIVEAWAY_ADMIN_PASSWORD;

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

async function kvSet(key, value) {
  await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return res.status(500).json({ error: 'giveaway backend is not configured yet' });
  }
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'admin password is not configured on the server yet' });
  }

  const { password, action, ...payload } = req.body || {};

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  try {
    if (action === 'create') {
      const prize = String(payload.prize || '').trim().slice(0, 120);
      const winnerCount = Math.max(1, Math.min(50, parseInt(payload.winnerCount, 10) || 1));
      const endsInHours = Math.max(0.1, Math.min(24 * 60, parseFloat(payload.endsInHours) || 24));
      if (!prize) return res.status(400).json({ error: 'Prize is required.' });

      const id = Date.now().toString(36);
      const giveaway = {
        id,
        prize,
        winnerCount,
        endsAt: Date.now() + endsInHours * 60 * 60 * 1000,
        active: true,
        createdAt: Date.now()
      };
      await kvSet('giveaway:current', giveaway);
      await kvSet(`giveaway:entries:${id}`, []);
      return res.status(200).json({ ok: true, giveaway });
    }

    if (action === 'list') {
      const current = await kvGet('giveaway:current');
      if (!current || !current.active) {
        return res.status(200).json({ ok: true, active: false, entries: [] });
      }
      const entries = (await kvGet(`giveaway:entries:${current.id}`)) || [];
      return res.status(200).json({ ok: true, active: true, giveaway: current, entries });
    }

    if (action === 'remove') {
      const current = await kvGet('giveaway:current');
      if (!current || !current.active) return res.status(400).json({ error: 'No active giveaway.' });
      const entriesKey = `giveaway:entries:${current.id}`;
      const entries = (await kvGet(entriesKey)) || [];
      const filtered = entries.filter((e) => e.email !== payload.email);
      await kvSet(entriesKey, filtered);
      return res.status(200).json({ ok: true, entries: filtered });
    }

    if (action === 'end') {
      const current = await kvGet('giveaway:current');
      if (!current || !current.active) return res.status(400).json({ error: 'No active giveaway.' });
      const entries = (await kvGet(`giveaway:entries:${current.id}`)) || [];
      const winner = entries.find((e) => e.email === payload.winnerEmail);
      if (!winner) return res.status(400).json({ error: 'That email is not in the entry list.' });

      const winners = (await kvGet('giveaway:winners')) || [];
      winners.push({
        prize: current.prize,
        winnerName: winner.name,
        winnerEmail: winner.email,
        endedAt: Date.now()
      });
      await kvSet('giveaway:winners', winners);
      await kvSet('giveaway:current', {
        ...current,
        active: false,
        winnerName: winner.name,
        endedAt: Date.now()
      });
      return res.status(200).json({ ok: true, winnerName: winner.name });
    }

    return res.status(400).json({ error: 'Unknown action.' });
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong.' });
  }
};
