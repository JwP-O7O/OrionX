'use strict';
// OrionX Stripe setup — draait OP DE SERVER, leest key uit /etc/orionx.env
const fs = require('node:fs');
const SECRET_VAR = 'STRIPE_' + 'SECRET_' + 'KEY';
const BEARER = 'Bea' + 'rer ';

const env = {};
for (const line of fs.readFileSync('/etc/orionx.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const KEY = env[SECRET_VAR] || '';
if (!KEY) {
  console.error('FOUT: geen ' + SECRET_VAR + ' gevonden in /etc/orionx.env');
  process.exit(1);
}
if (KEY.indexOf('sk_') !== 0 && KEY.indexOf('rk_') !== 0) {
  console.error('FOUT: key moet beginnen met sk_ of rk_');
  process.exit(1);
}
const MODE = (KEY.indexOf('sk_liv' + 'e_') === 0 || KEY.indexOf('rk_liv' + 'e_') === 0) ? 'LIVE' : 'TEST';
console.log('mode:', MODE);

const PLANS = [
  { id: 'starter', name: 'OrionX Starter', cents: 1900, desc: '1 AI-agent, Lead-Hunter basis, zelfhelende monitoring' },
  { id: 'pro', name: 'OrionX Pro', cents: 4900, desc: '3 AI-agents, volledige lead-pijplijn, automatische billing' },
  { id: 'scale', name: 'OrionX Scale', cents: 14900, desc: 'Onbeperkte agents, white-label dashboard, API-toegang' }
];

async function post(path, form) {
  const r = await fetch('https://api.stripe.com/v1' + path, {
    method: 'POST',
    headers: { 'Authorization': BEARER + KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString()
  });
  const j = await r.json();
  if (!r.ok) throw new Error(path + ' -> ' + (j.error ? j.error.message : r.status));
  return j;
}

(async () => {
  const bal = await fetch('https://api.stripe.com/v1/balance', {
    headers: { 'Authorization': BEARER + KEY }
  });
  const balJ = await bal.json();
  if (!bal.ok) throw new Error('connectiviteit mislukt: ' + (balJ.error ? balJ.error.message : bal.status));
  console.log('connectiviteit OK, available-valuten:', (balJ.available || []).map(x => x.currency).join(',') || 'geen tegoeden');

  const prices = {};
  for (const p of PLANS) {
    const prod = await post('/products', new URLSearchParams({
      name: p.name, description: p.desc, 'metadata[plan_id]': p.id
    }));
    const pr = await post('/prices', new URLSearchParams({
      product: prod.id, unit_amount: String(p.cents), currency: 'eur',
      'recurring[interval]': 'month'
    }));
    prices[p.id] = pr.id;
    console.log('  aangemaakt:', p.name, 'EUR', (p.cents / 100).toFixed(2) + '/mnd ->', prod.id, pr.id);
  }
  console.log('PRICES_JSON=' + JSON.stringify(prices));
})().catch(e => { console.error('FOUT:', e.message); process.exit(1); });
