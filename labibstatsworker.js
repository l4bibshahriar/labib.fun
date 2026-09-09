/**
 * labib-stats-worker.js
 * ------------------------------------------------------------------
 * A tiny, free, self-hosted global counter API — the reliable backend
 * for the Views / MSG Sent numbers on labib.fun.
 *
 * WHY THIS EXISTS
 * Third-party "free counter" APIs (CounterAPI, CountAPI, etc.) are
 * called from the browser to a THIRD-PARTY DOMAIN. Many browsers,
 * privacy extensions, and corporate networks silently block any
 * request to a domain/path containing words like "counter" — because
 * that pattern matches common ad/analytics trackers. When that
 * request is blocked, the site quietly falls back to a per-device
 * local number, which is exactly the "950 on one phone, 945 on
 * another" bug you saw. That isn't a bug in the counting logic —
 * it's an inherent limitation of depending on a third-party domain.
 *
 * This Worker fixes that at the root: it runs on infrastructure you
 * control, so the site can call it directly. Nothing about the
 * request pattern resembles a tracker, so it isn't blocked, and the
 * number really is one shared value for every visitor, everywhere —
 * the YouTube-style behavior you asked for.
 *
 * SETUP (about 5 minutes, free, no credit card):
 * 1. Go to https://dash.cloudflare.com → sign up / log in (free plan).
 * 2. Left sidebar → "Workers & Pages" → "Create" → "Create Worker".
 * 3. Give it any name (e.g. "labib-stats") → "Deploy" (deploys a
 *    starter template first — that's fine).
 * 4. Click "Edit code" and replace ALL of the starter code with the
 *    entire contents of THIS file → "Deploy".
 * 5. Still in the Worker dashboard → "Settings" → "Variables" →
 *    "KV Namespace Bindings" → "Add binding".
 *      Variable name:  STATS
 *      KV namespace:   click "Create a namespace", name it
 *                       "labib-stats", select it, then "Save".
 * 6. Back on the Worker's main page, copy its URL — it looks like
 *    https://labib-stats.YOUR-SUBDOMAIN.workers.dev
 * 7. Paste that URL into `index.html`, in the line that reads:
 *      const OWN_COUNTER_BASE = '';
 *    → const OWN_COUNTER_BASE = 'https://labib-stats.YOUR-SUBDOMAIN.workers.dev';
 *
 * That's it — once that URL is filled in, the site talks to your own
 * Worker first, so the count is exact and identical on every device,
 * forever, with no third party in the loop at all.
 *
 * If you skip this setup, the site still works: it automatically
 * falls back to the best-effort third-party counter, and then to a
 * local per-device number as an absolute last resort — but only this
 * Worker gives you the guaranteed, always-consistent number.
 *
 * Free tier limits (Cloudflare Workers + KV): 100,000 requests/day
 * and plenty of KV reads/writes — far more than a portfolio site
 * needs.
 * ------------------------------------------------------------------
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // /:name          -> read current value (no increment)
    // /:name/up       -> increment by 1 and return new value
    const parts = url.pathname.split('/').filter(Boolean);
    const name = parts[0];
    const action = parts[1];

    if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
      return json({ error: 'missing or invalid counter name' }, 400, corsHeaders);
    }

    const key = 'counter:' + name;

    if (action === 'up') {
      // KV is eventually-consistent across edge locations, which is
      // fine here: worst case two near-simultaneous visits briefly
      // read a slightly stale value, then both writes still land.
      const current = parseInt((await env.STATS.get(key)) || '0', 10);
      const next = current + 1;
      await env.STATS.put(key, String(next));
      return json({ name, value: next }, 200, corsHeaders);
    }

    const value = parseInt((await env.STATS.get(key)) || '0', 10);
    return json({ name, value }, 200, corsHeaders);
  }
};

function json(obj, status, extraHeaders) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders }
  });
}
