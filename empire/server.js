'use strict';
// OrionX-AI Empire — zero-dependency Node.js SaaS kernel
// Modules: leads (Hunter) | billing (Stripe) | AI (Vertex Gemini) | admin cockpit
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = process.env.ORIONX_HOME || '/opt/orionx';
const DATA = path.join(ROOT, 'data');
const WEB = path.join(ROOT, 'web');
const PORT = parseInt(process.env.PORT || '8080', 10);
const ADMIN = process.env.ORIONX_ADMIN || '';
const SITE = process.env.SITE_URL || 'http://34.90.77.106';
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WH_SEC = process.env.STRIPE_WEBHOOK_SECRET || '';
const PRICES = safeJson(process.env.STRIPE_PRICES, {});
const RESEND_KEY = process.env.RESEND_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'OrionX <no-reply@orionx.ai>';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const BOOT = Date.now();

const PLANS = [
  { id: 'starter', name: 'Starter', eur: 19, tag: 'Voor solos',
    features: ['1 AI-agent', 'Lead-Hunter basis', 'Zelfhelende monitoring', 'E-mail support'] },
  { id: 'pro', name: 'Pro', eur: 49, tag: 'Voor teams',
    features: ['3 AI-agents', 'Volledige lead-pijplijn', 'Automatische billing + dunning', 'Priority support'] },
  { id: 'scale', name: 'Scale', eur: 149, tag: 'Voor bureaus',
    features: ['Onbeperkte agents', 'White-label dashboard', 'API-toegang', 'SLA 99,9%'] }
];

function safeJson(s, fb) { try { return JSON.parse(s); } catch { return fb; } }
function readJson(f, fb) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fb; } }
function writeJson(f, o) {
  const t = f + '.tmp';
  fs.writeFileSync(t, JSON.stringify(o));
  fs.renameSync(t, f);
}
function logEvent(type, data) {
  try {
    fs.appendFileSync(path.join(DATA, 'events.jsonl'),
      JSON.stringify(Object.assign({ ts: new Date().toISOString(), type }, data)) + '\n');
  } catch (e) {}
}
function loadLeads() { return readJson(path.join(DATA, 'leads.json'), { byEmail: {} }); }
function saveLeads(l) { writeJson(path.join(DATA, 'leads.json'), l); }
function loadSubs() { return readJson(path.join(DATA, 'subscribers.json'), { byCustomer: {} }); }
function loadProspects() { return readJson(path.join(DATA, 'prospects.json'), { byId: {} }); }
function saveSubs(s) { writeJson(path.join(DATA, 'subscribers.json'), s); }

// --- rate limiter (per IP+bucket) ---
const hits = new Map();
function rl(ip, bucket, max, windowMs) {
  const key = ip + '|' + bucket;
  const now = Date.now();
  const arr = (hits.get(key) || []).filter(t => now - t < windowMs);
  if (arr.length >= max) return false;
  arr.push(now);
  hits.set(key, arr);
  return true;
}

// --- GCP metadata (server has cloud-platform scope -> free AI calls) ---
function metaVal(p) {
  return new Promise((resolve, reject) => {
    const req = http.get({
      host: 'metadata.google.internal', path: p,
      headers: { 'Metadata-Flavor': 'Google' }, timeout: 4000
    }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('meta timeout')); });
  });
}
async function vertexAsk(prompt) {
  const [projRaw, tokJson] = await Promise.all([
    metaVal('/computeMetadata/v1/project/project-id'),
    metaVal('/computeMetadata/v1/instance/service-accounts/default/token')
  ]);
  const proj = projRaw.trim();
  let acc = '';
  try {
    acc = (JSON.parse(tokJson).access_token || '').trim();
  } catch (e) {
    throw new Error('metadata-token kon niet gelezen worden');
  }
  if (!proj || !acc) throw new Error('metadata onvolledig');
  const url = 'https://aiplatform.googleapis.com/v1/projects/' + proj +
    '/locations/global/publishers/google/models/' + GEMINI_MODEL + ':generateContent';
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + acc },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 500, temperature: 0.7 }
    })
  });
  if (!r.ok) throw new Error('vertex ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  const c = j.candidates && j.candidates[0];
  return c && c.content && c.content.parts ? c.content.parts.map(p => p.text).join('') : '';
}

// --- Stripe ---
function stripeVerify(raw, header) {
  if (!STRIPE_WH_SEC || !header) return false;
  const ts = (header.match(/t=(\d+)/) || [])[1];
  const sigs = header.split(',').filter(s => s.trim().startsWith('v1=')).map(s => s.trim().slice(3));
  if (!ts || !sigs.length) return false;
  const expected = crypto.createHmac('sha256', STRIPE_WH_SEC).update(ts + '.' + raw).digest('hex');
  return sigs.some(s => {
    try {
      return crypto.timingSafeEqual(Buffer.from(s, 'hex'), Buffer.from(expected, 'hex'));
    } catch (e) { return false; }
  });
}
async function stripeCheckout(plan, email) {
  if (!STRIPE_KEY) { const e = new Error('billing nog niet geconfigureerd — STRIPE_SECRET_KEY ontbreekt'); e.code = 501; throw e; }
  const price = PRICES[plan];
  if (!price) { const e = new Error('onbekend plan: ' + plan); e.code = 400; throw e; }
  const body = new URLSearchParams({
    mode: 'subscription',
    success_url: SITE + '/?checkout=success',
    cancel_url: SITE + '/?checkout=cancel',
    client_reference_id: plan,
    'line_items[0][price]': price,
    'line_items[0][quantity]': '1'
  });
  if (email) body.set('customer_email', email);
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + STRIPE_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  const j = await r.json();
  if (!r.ok) { const e = new Error((j.error && j.error.message) || 'stripe ' + r.status); e.code = 502; throw e; }
  return j.url;
}

// --- email (Resend transport; pas actief zodra RESEND_KEY gezet) ---
async function sendWelcome(to, name) {
  if (!RESEND_KEY) return false;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: EMAIL_FROM, to: [to],
      subject: 'Welkom bij OrionX-AI',
      html: '<p>Hey ' + (name || 'daar') + ',</p><p>Bedankt voor je aanmelding. Jouw toegang tot het autonome AI-cockpit volgt. Terwijl je wacht: <a href="' + SITE + '">' + SITE + '</a></p><p>— OrionX</p>'
    })
  });
  return r.ok;
}

// --- HTTP server ---
function send(res, code, obj, headers) {
  const body = typeof obj === 'string' ? obj : JSON.stringify(obj);
  res.writeHead(code, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers || {}));
  res.end(body);
}
function serveFile(res, file, type) {
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, { error: 'niet gevonden' });
    res.writeHead(200, { 'Content-Type': type });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?').split(',')[0].trim();
  const p = u.pathname;
  const adminOk = ADMIN && req.headers.authorization === 'Bearer ' + ADMIN;
  let raw = '';
  if (req.method === 'POST') {
    req.on('data', c => { raw += c; if (raw.length > 200000) req.destroy(); });
    await new Promise(r => req.on('end', r));
  }
  try {
    if (req.method === 'GET' && p === '/health') {
      const l = loadLeads(), s = loadSubs();
      return send(res, 200, {
        ok: true, uptime_s: Math.round((Date.now() - BOOT) / 1000),
        time: new Date().toISOString(),
        store: { leads: Object.keys(l.byEmail).length, subscribers: Object.keys(s.byCustomer).length },
        features: {
          billing: !!STRIPE_KEY, email: !!RESEND_KEY,
          webhook_secret: !!STRIPE_WH_SEC, admin: !!ADMIN
        }
      });
    }
    if (req.method === 'GET' && (p === '/' || p === '/index.html')) return serveFile(res, path.join(WEB, 'index.html'), 'text/html; charset=utf-8');
    if (req.method === 'GET' && (p === '/admin' || p === '/admin.html')) return serveFile(res, path.join(WEB, 'admin.html'), 'text/html; charset=utf-8');
    if (req.method === 'GET' && p === '/api/plans') return send(res, 200, { plans: PLANS });

    if (req.method === 'POST' && p === '/api/leads') {
      if (!rl(ip, 'lead', 10, 600000)) return send(res, 429, { error: 'te veel pogingen' });
      const b = safeJson(raw, {});
      if (b.company) return send(res, 201, { ok: true }); // honeypot: bots slikken dit in, doen niets
      if (!b.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(b.email)) return send(res, 400, { error: 'ongeldig e-mailadres' });
      const email = b.email.toLowerCase();
      const store = loadLeads();
      if (store.byEmail[email]) return send(res, 200, { ok: true, existed: true });
      store.byEmail[email] = {
        email, name: (b.name || '').slice(0, 120), source: (b.source || 'direct').slice(0, 60),
        consent: !!b.consent, ts: new Date().toISOString(), status: 'nieuw'
      };
      saveLeads(store);
      logEvent('lead', { email, source: store.byEmail[email].source });
      sendWelcome(email, b.name).catch(() => {});
      return send(res, 201, { ok: true });
    }

    if (req.method === 'POST' && p === '/api/checkout') {
      if (!rl(ip, 'checkout', 20, 600000)) return send(res, 429, { error: 'te veel pogingen' });
      const b = safeJson(raw, {});
      const url = await stripeCheckout(b.plan, b.email);
      logEvent('checkout_created', { plan: b.plan, email: b.email || '' });
      return send(res, 200, { url });
    }

    if (req.method === 'POST' && p === '/api/billing/webhook') {
      if (!stripeVerify(raw, req.headers['stripe-signature'] || '')) return send(res, 400, { error: 'invalid signature' });
      const ev = safeJson(raw, {});
      const obj = ev.data && ev.data.object || {};
      const store = loadSubs();
      const cust = obj.customer || 'unknown';
      if (ev.type === 'checkout.session.completed') {
        store.byCustomer[cust] = {
          customer: cust, email: obj.customer_details && obj.customer_details.email || '',
          plan: obj.client_reference_id || '', status: 'actief',
          since: new Date(obj.created * 1000).toISOString()
        };
        logEvent('sub_activated', { cust, plan: store.byCustomer[cust].plan });
      } else if (ev.type === 'customer.subscription.updated' || ev.type === 'customer.subscription.deleted' || ev.type === 'invoice.payment_failed') {
        if (store.byCustomer[cust]) {
          store.byCustomer[cust].status = ev.type === 'customer.subscription.deleted' ? 'opgezegd' : (ev.status || store.byCustomer[cust].status);
        }
        logEvent('sub_event', { type: ev.type, cust });
      }
      saveSubs(store);
      return send(res, 200, { received: true, type: ev.type });
    }

    if (req.method === 'POST' && p === '/api/ai') {
      if (!rl(ip, 'ai', 10, 60000)) return send(res, 429, { error: 'te veel aanvragen' });
      const b = safeJson(raw, {});
      const q = String(b.message || '').slice(0, 2000);
      if (!q) return send(res, 400, { error: 'message vereist' });
      const sys = 'Je bent de assistent van OrionX-AI, een platform voor autonome AI-operaties (lead-acquisitie, monitoring, billing). Houd antwoorden kort, zakelijk, Nederlands. Prizen: Starter EUR19, Pro EUR49, Scale EUR149/mnd.';
      const answer = await vertexAsk(sys + '\n\nVraag van bezoeker: ' + q);
      return send(res, 200, { answer });
    }

    if (p.startsWith('/api/admin/')) {
      if (!adminOk) return send(res, 401, { error: 'geen toegang' });
      const l = loadLeads(), s = loadSubs();
      const leads = Object.values(l.byEmail).sort((a, b) => b.ts.localeCompare(a.ts));
      const subs = Object.values(s.byCustomer);
      const prospects = Object.values(loadProspects().byId).sort((x, y) => (y.score || 0) - (x.score || 0));
      if (p === '/api/admin/overview') {
        return send(res, 200, {
          mrr_eur: subs.filter(x => x.status === 'actief').reduce((t, x) => t + ((PLANS.find(pl => pl.id === x.plan) || { eur: 0 }).eur), 0),
          total_leads: leads.length,
          prospects: prospects.slice(0, 40),
          leads_24h: leads.filter(x => Date.now() - Date.parse(x.ts) < 864e5).length,
          subscribers: subs,
          recent_leads: leads.slice(0, 50),
          features: { billing: !!STRIPE_KEY, email: !!RESEND_KEY, webhook: !!STRIPE_WH_SEC }
        });
      }
      if (p === '/api/admin/hunter/run' && req.method === 'POST') {
        require('node:child_process').spawn('/usr/bin/node', ['/opt/orionx/hunter.js'], { detached: true, stdio: 'ignore' }).unref();
        return send(res, 202, { ok: true });
      }
      if (p === '/api/admin/export.csv') {
        const rows = ['email,naam,bron,consent,datum,status'];
        for (const x of leads) rows.push([x.email, x.name, x.source, x.consent, x.ts, x.status].join(','));
        return send(res, 200, rows.join('\n'), { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename=orionx-leads.csv' });
      }
      if (p === '/api/admin/lead/delete' && req.method === 'POST') {
        const b = safeJson(raw, {});
        const email = String(b.email || '').toLowerCase();
        if (l.byEmail[email]) { delete l.byEmail[email]; saveLeads(l); logEvent('lead_deleted', { email }); }
        return send(res, 200, { ok: true });
      }
      return send(res, 404, { error: 'onbekend admin-endpoint' });
    }
    return send(res, 404, { error: 'niet gevonden' });
  } catch (e) {
    logEvent('error', { msg: String(e.message || e).slice(0, 300), path: p });
    return send(res, e.code === 501 ? 501 : 500, { error: String(e.message || 'intern').slice(0, 200) });
  }
});
server.listen(PORT, '127.0.0.1', () => console.log('OrionX kernel op :' + PORT));
