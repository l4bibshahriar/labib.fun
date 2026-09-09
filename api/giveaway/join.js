/**
 * POST /api/giveaway/join
 *
 * Request a Gmail OTP:
 *   { action: 'request', name, email }
 *
 * Verify OTP and join:
 *   { action: 'verify', email, otp }
 *
 * Verified Gmail addresses are permanently whitelisted in Upstash Redis.
 * OTPs expire after 10 minutes. A pending OTP is reused during that window
 * so clicking Join Giveaway again does not send another code.
 *
 * Required Vercel environment variables:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *   RESEND_API_KEY
 *   RESEND_FROM_EMAIL   e.g. Giveaway <giveaway@labib.fun>
 */

const crypto = require('crypto');

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
const GMAIL_RE = /^[^\s@]+@gmail\.com$/i;
const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

async function kvGet(key) {
  const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
  const data = await res.json();
  if (!data || data.result == null) return null;
  try { return JSON.parse(data.result); } catch (e) { return null; }
}

async function kvSet(key, value) {
  const res = await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  });
  if (!res.ok) throw new Error('database write failed');
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

function makeOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function calculateWinningRate(entryCount, winnerCount) {
  if (!entryCount || !winnerCount) return '0.00';
  return Math.min(100, (winnerCount / entryCount) * 100).toFixed(2);
}

async function sendOtpEmail(email, otp) {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    throw new Error('Email delivery is not configured on the server. Add RESEND_API_KEY and RESEND_FROM_EMAIL in Vercel.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: [email],
      subject: 'Your Nona_soriyan Giveaway verification code',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px;color:#171717">
          <h2 style="margin:0 0 12px">Nona_soriyan Giveaway</h2>
          <p>Use the verification code below to confirm your giveaway entry.</p>
          <div style="font-size:32px;font-weight:800;letter-spacing:8px;padding:18px 20px;margin:20px 0;background:#f5f5f5;border-radius:12px;text-align:center">${otp}</div>
          <p style="color:#666">This code expires in <strong>10 minutes</strong>. If you did not request it, you can ignore this email.</p>
        </div>
      `
    })
  });

  if (!response.ok) {
    let details = '';
    try {
      const data = await response.json();
      details = data && data.message ? ` ${data.message}` : '';
    } catch (e) {}
    throw new Error(`Could not send the verification email.${details}`);
  }
}

async function getActiveGiveaway() {
  const current = await kvGet('giveaway:current');
  if (!current || !current.active) throw new Error('There is no active giveaway right now.');
  if (Date.now() > current.endsAt) throw new Error('This giveaway has already ended.');
  return current;
}

async function getEntryState(current) {
  const entriesKey = `giveaway:entries:${current.id}`;
  const entries = (await kvGet(entriesKey)) || [];
  return { entriesKey, entries };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return res.status(500).json({ error: 'giveaway backend is not configured yet' });
  }

  try {
    const body = req.body || {};
    const action = String(body.action || 'request');
    const cleanEmail = String(body.email || '').trim().toLowerCase().slice(0, 120);

    if (!GMAIL_RE.test(cleanEmail)) {
      return res.status(400).json({ error: 'Only valid Gmail addresses are accepted.' });
    }

    const current = await getActiveGiveaway();
    const { entriesKey, entries } = await getEntryState(current);

    if (entries.some((e) => e.email === cleanEmail)) {
      return res.status(200).json({
        ok: true,
        alreadyJoined: true,
        entryCount: entries.length,
        winnerCount: current.winnerCount,
        winningRate: calculateWinningRate(entries.length, current.winnerCount)
      });
    }

    const whitelistKey = `giveaway:verified:${cleanEmail}`;
    const verifiedRecord = await kvGet(whitelistKey);

    if (action === 'request') {
      const cleanName = String(body.name || '').trim().slice(0, 60);
      if (!cleanName) return res.status(400).json({ error: 'Clash of Clans ID name is required.' });

      // Permanently verified Gmail: no OTP needed for future giveaways.
      if (verifiedRecord && verifiedRecord.verified === true) {
        entries.push({ name: cleanName, email: cleanEmail, joinedAt: Date.now(), verified: true });
        await kvSet(entriesKey, entries);
        return res.status(200).json({
          ok: true,
          verified: true,
          alreadyJoined: false,
          entryCount: entries.length,
          winnerCount: current.winnerCount,
          winningRate: calculateWinningRate(entries.length, current.winnerCount)
        });
      }

      const otpKey = `giveaway:otp:${cleanEmail}`;
      const pending = await kvGet(otpKey);
      const now = Date.now();

      // Reuse the existing OTP while it is alive. This is what makes the
      // "I clicked Join, went to Gmail, came back and the popout was gone"
      // flow easy: clicking Join again only asks for the same OTP.
      if (pending && pending.expiresAt > now && pending.giveawayId === current.id) {
        return res.status(200).json({
          ok: true,
          otpRequired: true,
          reused: true,
          expiresAt: pending.expiresAt,
          email: cleanEmail
        });
      }

      const otp = makeOtp();
      const expiresAt = now + OTP_TTL_MS;
      const otpRecord = {
        giveawayId: current.id,
        name: cleanName,
        email: cleanEmail,
        otpHash: hashOtp(otp),
        createdAt: now,
        expiresAt,
        attempts: 0,
        lastSentAt: now
      };

      // Save before sending so a double-click cannot generate competing codes.
      await kvSet(otpKey, otpRecord);
      try {
        await sendOtpEmail(cleanEmail, otp);
      } catch (emailErr) {
        await kvSet(otpKey, null);
        throw emailErr;
      }

      return res.status(200).json({
        ok: true,
        otpRequired: true,
        reused: false,
        expiresAt,
        email: cleanEmail
      });
    }

    if (action === 'verify') {
      const otp = String(body.otp || '').replace(/\D/g, '').slice(0, 6);
      if (!/^\d{6}$/.test(otp)) return res.status(400).json({ error: 'Please enter the 6-digit OTP from your Gmail.' });

      const otpKey = `giveaway:otp:${cleanEmail}`;
      const pending = await kvGet(otpKey);
      const now = Date.now();

      if (!pending || pending.giveawayId !== current.id) {
        return res.status(400).json({ error: 'No active OTP was found. Click Join Giveaway again to request a new one.' });
      }
      if (now > pending.expiresAt) {
        await kvSet(otpKey, null);
        return res.status(400).json({ error: 'This OTP has expired. Click Join Giveaway again to request a new code.' });
      }
      if ((pending.attempts || 0) >= 8) {
        await kvSet(otpKey, null);
        return res.status(429).json({ error: 'Too many incorrect attempts. Request a new OTP.' });
      }

      if (hashOtp(otp) !== pending.otpHash) {
        pending.attempts = (pending.attempts || 0) + 1;
        await kvSet(otpKey, pending);
        return res.status(400).json({ error: `Incorrect OTP. ${Math.max(0, 8 - pending.attempts)} attempts remaining.` });
      }

      // Permanently whitelist the verified Gmail.
      await kvSet(whitelistKey, {
        verified: true,
        email: cleanEmail,
        verifiedAt: verifiedRecord && verifiedRecord.verifiedAt ? verifiedRecord.verifiedAt : now
      });

      if (!entries.some((e) => e.email === cleanEmail)) {
        entries.push({
          name: pending.name,
          email: cleanEmail,
          joinedAt: now,
          verified: true
        });
        await kvSet(entriesKey, entries);
      }

      await kvSet(otpKey, null);

      return res.status(200).json({
        ok: true,
        verified: true,
        alreadyJoined: false,
        entryCount: entries.length,
        winnerCount: current.winnerCount,
        winningRate: calculateWinningRate(entries.length, current.winnerCount)
      });
    }

    return res.status(400).json({ error: 'Unknown giveaway action.' });
  } catch (err) {
    console.error('giveaway join error:', err);
    return res.status(500).json({ error: err.message || 'Something went wrong. Please try again.' });
  }
};
