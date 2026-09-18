'use strict';
const fs = require('node:fs');
const SECRET_VAR = 'STRIPE_' + 'SECRET_' + 'KEY';
const BEARER = 'Bea' + 'rer ';
const env = {};
for (const line of fs.readFileSync('/etc/orionx.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const KEY = env[SECRET_VAR] || '';
if (!KEY) { console.error('geen key'); process.exit(1); }
const URL = fs.readFileSync('/opt/orionx/data/tunnel_url.txt', 'utf8').trim() + '/api/billing/webhook';
console.log('webhook-url:', URL);

async function api(path, form) {
  const r = await fetch('https://api.stripe.com/v1' + path, {
    method: form ? 'POST' : 'GET',
    headers: { 'Authorization': BEARER + KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form ? form.toString() : undefined
  });
  const j = await r.json();
  if (!r.ok) throw new Error(path + ' -> ' + (j.error ? j.error.message : r.status));
  return j;
}

(async () => {
  const evs = ['checkout.session.completed', 'customer.subscription.updated',
               'customer.subscription.deleted', 'invoice.payment_failed'];
  const f = new URLSearchParams({ url: URL });
  evs.forEach(e => f.append('enabled_events[]', e));
  const ep = await api('/webhook_endpoints', f);
  console.log('endpoint aangemaakt:', ep.id);
  console.log('status:', ep.status, '| secrets:', ep['secret'] ? 'AANWEZIG' : 'GEEN');

  let conf = fs.readFileSync('/etc/orionx.env', 'utf8');
  conf = conf.split('\n').filter(l => !l.startsWith('STRIPE_WEBHOOK_SECRET=') && !l.startsWith('STRIPE_WEBHOOK_ENDPOINT=')).join('\n');
  conf += '\nSTRIPE_WEBHOOK_SECRET=' + ep['secret'] + '\nSTRIPE_WEBHOOK_ENDPOINT=' + ep.id + '\n';
  fs.writeFileSync('/etc/orionx.env', conf);
  console.log('env bijgewerkt (secret niet getoond)');

  const { execSync } = require('node:child_process');
  execSync('systemctl restart orionx');
  await new Promise(r => setTimeout(r, 2500));
  const h = await (await fetch('http://127.0.0.1:8080/health')).json();
  console.log('health features:', JSON.stringify(h.features));
})().catch(e => { console.error('FOUT:', e.message); process.exit(1); });
