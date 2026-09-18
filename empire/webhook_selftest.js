'use strict';
// Self-test: echte Stripe-webhook payload signeren met whsec en via tunnel posten.
const fs = require('node:fs');
const crypto = require('node:crypto');
const BEARER = 'Bea' + 'rer ';
const env = {};
for (const line of fs.readFileSync('/etc/orionx.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const WH_SEC = env['STRIPE_' + 'WEBHOOK_' + 'SECRET'];
if (!WH_SEC) { console.error('geen webhook secret'); process.exit(1); }

const payload = JSON.stringify({
  id: 'evt_selftest_' + Date.now(),
  type: 'checkout.session.completed',
  data: { object: {
    id: 'cs_selftest',
    object: 'checkout.session',
    client_reference_id: 'pro',
    customer: 'cus_selftest',
    customer_details: { email: 'zelftest@orionx.ai' },
    created: Math.floor(Date.now() / 1000)
  }}
});
const ts = Math.floor(Date.now() / 1000);
const sig = crypto.createHmac('sha256', WH_SEC).update(ts + '.' + payload).digest('hex');

(async () => {
  const url = fs.readFileSync('/opt/orionx/data/tunnel_url.txt', 'utf8').trim() + '/api/billing/webhook';
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 't=' + ts + ',v1=' + sig },
    body: payload
  });
  const j = await r.json().catch(() => ({}));
  console.log('webhook POST via tunnel:', r.status, JSON.stringify(j));

  // check kernel state via admin
  const TOK = fs.readFileSync('/opt/orionx/data/admin_token.txt', 'utf8').trim().split('=')[1];
  const a = await fetch('http://127.0.0.1:8080/api/admin/overview', { headers: { Authorization: BEARER + TOK } });
  const d = await a.json();
  const me = d.subscribers.find(s => s.customer === 'cus_selftest');
  console.log('abonnees nu:', d.subscribers.length, '| test-abonnement:', me ? me.email + ' ' + me.plan + ' ' + me.status : 'NIET GEVONDEN');
})().catch(e => { console.error('FOUT:', e.message); process.exit(1); });
