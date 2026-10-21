// Ricomp — server notifiche (Cloudflare Worker, piano gratuito)
// Serve: un KV namespace collegato con il nome STORE e un Cron Trigger "* * * * *".
// Facoltativo: variabile SECRET (stessa password da inserire nell'app).
//
// Il worker non conosce i tuoi dati: sveglia il telefono agli orari impostati
// e il service worker dell'app decide quale promemoria mostrare.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const enc = new TextEncoder();

async function getKeys(env) {
  let keys = await env.STORE.get('vapid', 'json');
  if (keys) return keys;
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicKey = b64url(await crypto.subtle.exportKey('raw', pair.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  keys = { publicKey, jwk };
  await env.STORE.put('vapid', JSON.stringify(keys));
  return keys;
}

async function vapidHeader(endpoint, keys) {
  const header = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = b64url(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: 'mailto:ricomp@example.com',
  })));
  const key = await crypto.subtle.importKey('jwk', keys.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${payload}`));
  return `vapid t=${header}.${payload}.${b64url(sig)}, k=${keys.publicKey}`;
}

// Push senza contenuto: non serve cifratura, il telefono si sveglia e decide cosa mostrare.
async function sendPush(sub, keys) {
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: { Authorization: await vapidHeader(sub.endpoint, keys), TTL: '900', Urgency: 'high' },
  });
  return res.status;
}

async function idOf(endpoint) {
  const h = await crypto.subtle.digest('SHA-256', enc.encode(endpoint));
  return b64url(h).slice(0, 22);
}

const okSecret = (env, body) => !env.SECRET || body.secret === env.SECRET;

function localNow(tz) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz || 'Europe/Madrid', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  const hh = get('hour') === '24' ? '00' : get('hour');
  return { t: `${hh}:${get('minute')}`, wd };
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    try {
      if (url.pathname === '/key') return json({ publicKey: (await getKeys(env)).publicKey });
      if (url.pathname === '/' || url.pathname === '/status') {
        const subs = (await env.STORE.get('subs', 'json')) || {};
        return json({ ok: true, app: 'ricomp', devices: Object.keys(subs).length, secret: !!env.SECRET });
      }
      if (req.method !== 'POST') return json({ error: 'not found' }, 404);
      const body = await req.json();
      if (!okSecret(env, body)) return json({ error: 'Password del server errata' }, 401);

      if (url.pathname === '/subscribe') {
        const { subscription, tz, slots } = body;
        if (!subscription?.endpoint) return json({ error: 'subscription mancante' }, 400);
        const subs = (await env.STORE.get('subs', 'json')) || {};
        const id = await idOf(subscription.endpoint);
        if (!subs[id] && Object.keys(subs).length >= 5) return json({ error: 'Troppi dispositivi registrati' }, 429);
        subs[id] = { endpoint: subscription.endpoint, tz, slots: (slots || []).slice(0, 200), updated: Date.now() };
        await env.STORE.put('subs', JSON.stringify(subs));
        return json({ ok: true, id, slots: subs[id].slots.length });
      }
      if (url.pathname === '/unsubscribe') {
        const subs = (await env.STORE.get('subs', 'json')) || {};
        delete subs[await idOf(body.endpoint || '')];
        await env.STORE.put('subs', JSON.stringify(subs));
        return json({ ok: true });
      }
      if (url.pathname === '/test') {
        const status = await sendPush({ endpoint: body.endpoint }, await getKeys(env));
        return json({ ok: status < 300, status });
      }
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    const subs = (await env.STORE.get('subs', 'json')) || {};
    const ids = Object.keys(subs);
    if (!ids.length) return;
    const keys = await getKeys(env);
    let changed = false;
    await Promise.all(ids.map(async (id) => {
      const s = subs[id];
      const now = localNow(s.tz);
      const due = (s.slots || []).some((x) => x.t === now.t && (!x.days || x.days.includes(now.wd)));
      if (!due) return;
      const status = await sendPush(s, keys);
      if (status === 404 || status === 410) { delete subs[id]; changed = true; }
    }));
    if (changed) await env.STORE.put('subs', JSON.stringify(subs));
  },
};
