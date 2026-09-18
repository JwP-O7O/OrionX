'use strict';
// OrionX Outreach — genereert gepersonaliseerde, niet-spammy drafts per top-lead via Vertex (gratis)
// Schrijft outreach naar prospects.json + een leesbare outreach.md. VERSTUURT NIETS.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const DATA = '/opt/orionx/data';
const GEMINI_MODEL = 'gemini-2.5-flash';
const TOP = parseInt(process.env.OUTREACH_TOP || '8', 10);

function metaVal(p) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: 'metadata.google.internal', path: p, headers: { 'Metadata-Flavor': 'Google' }, timeout: 4000 }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(d));
    });
    req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('meta timeout')); });
  });
}
async function vertexAsk(prompt) {
  const [projRaw, tokJson] = await Promise.all([
    metaVal('/computeMetadata/v1/project/project-id'),
    metaVal('/computeMetadata/v1/instance/service-accounts/default/token')
  ]);
  const proj = projRaw.trim();
  const acc = (JSON.parse(tokJson).access_token || '').trim();
  const url = 'https://aiplatform.googleapis.com/v1/projects/' + proj +
    '/locations/global/publishers/google/models/' + GEMINI_MODEL + ':generateContent';
const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bea' + 'rer ' + acc },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1024, temperature: 0.8, thinkingConfig: { thinkingBudget: 0 } } }) });
  if (!r.ok) throw new Error('vertex ' + r.status);
  const j = await r.json();
  const c = j.candidates && j.candidates[0];
  return c && c.content && c.content.parts ? c.content.parts.map(x => x.text).join('') : '';
}

function load() { try { return JSON.parse(fs.readFileSync(path.join(DATA, 'prospects.json'), 'utf8')); } catch { return { byId: {} }; } }

const PITCH = 'OrionX-AI: een autonome AI-agent die voor solo-founders en kleine teams hun operationele werk overneemt — infra-monitoring met zelfherstel, support-triage, en lead/opvolg-automatisering — inclusief een live cockpit. Zie demo.';

(async () => {
  const store = load();
  const top = Object.values(store.byId).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, TOP);
  const lines = ['# OrionX Outreach Drafts', '', 'Gebaseerd op top-' + top.length + ' Hunter-prospects. DRAFTS — review en pas aan voor versturen.', ''];
  let n = 0;
  for (const p of top) {
    let draft = '';
    try {
      const prompt = 'Je schrijft een korte, oprechte, niet-spammy outreach voor OrionX-AI. ' +
        'Context product: ' + PITCH + ' ' +
        'Doelwit is de maker van deze Show HN-post: "' + p.titel + '" (' + p.url + '). ' +
        'Reden van fit: ' + (p.why || '') + '. ' +
        'Schrijf in het ENGELS, max 70 woorden, als een reactie die je onder hun HN-thread of in een DM zou plaatsen. ' +
        'Begin met iets specifieks over HUN product (niet over ons). Wees een peer, geen verkoper. Eindig met één zachte vraag. Geen emojis, geen "I hope this finds you well". Alleen het bericht zelf.';
      draft = (await vertexAsk(prompt)).trim();
    } catch (e) { draft = '(generatie faalde: ' + e.message + ')'; }
    p.outreach = draft;
    n++;
    lines.push('## ' + n + '. ' + p.titel);
    lines.push('- maker: ' + (p.maker || '?') + ' | score: ' + p.score + ' | ' + p.url);
    lines.push('');
    lines.push(draft);
    lines.push('');
  }
  fs.writeFileSync(path.join(DATA, 'prospects.json.tmp'), JSON.stringify(store));
  fs.renameSync(path.join(DATA, 'prospects.json.tmp'), path.join(DATA, 'prospects.json'));
  fs.writeFileSync(path.join(DATA, 'outreach.md'), lines.join('\n'));
  console.log('outreach klaar: ' + n + ' drafts -> /opt/orionx/data/outreach.md');
})().catch(e => { console.error('outreach FOUT:', e.message); process.exit(1); });
