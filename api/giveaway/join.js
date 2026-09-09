/**
 * POST /api/giveaway/join
 * Public. Body: { name, email }
 * Adds an entry to the current active giveaway. Gmail-only, one entry
 * per email, blocked once the giveaway has expired or none is active.
 */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const GMAIL_RE = /^[^\s@]+@gmail\.com$/i;

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

  try {
    const { name, email } = req.body || {};
    const cleanName = String(name || '').trim().slice(0, 60);
    const cleanEmail = String(email || '').trim().toLowerCase().slice(0, 120);

    if (!cleanName) return res.status(400).json({ error: 'Clan ID name is required.' });
    if (!GMAIL_RE.test(cleanEmail)) return res.status(400).json({ error: 'Only Gmail addresses are accepted.' });

    const current = await kvGet('giveaway:current');
    if (!current || !current.active) {
      return res.status(400).json({ error: 'There is no active giveaway right now.' });
    }
    if (Date.now() > current.endsAt) {
      return res.status(400).json({ error: 'This giveaway has already ended.' });
    }

    const entriesKey = `giveaway:entries:${current.id}`;
    const entries = (await kvGet(entriesKey)) || [];

    if (entries.some((e) => e.email === cleanEmail)) {
      return res.status(200).json({ ok: true, alreadyJoined: true, entryCount: entries.length });
    }

    entries.push({ name: cleanName, email: cleanEmail, joinedAt: Date.now() });
    await kvSet(entriesKey, entries);

    return res.status(200).json({ ok: true, alreadyJoined: false, entryCount: entries.length });
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
