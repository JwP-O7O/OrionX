'use strict';
// OrionX Hunter — autonome lead-verkenner
//bron: publieke HackerNews Show-HHN posts (Algolia API) -> score via Vertex (gratis) -> prospects.json
// Geen bulk-mail: dit vindt en rangschikt; opvolging blijft mens/CLI-gecontroleerd.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const DATA = '/opt/orionx/data';
const GEMINI_MODEL = 'gemini-2.5-flash';
const PER_RUN = 24;

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
      generationConfig: { maxOutputTokens: 2048, temperature: 0.3, thinkingConfig: { thinkingBudget: 0 } } }) });
  if (!r.ok) throw new Error('vertex ' + r.status);
  const j = await r.json();
  const c = j.candidates && j.candidates[0];
  return c && c.content && c.content.parts ? c.content.parts.map(x => x.text).join('') : '';
}

async function fetchHN() {
  const since = Math.floor(Date.now() / 1000) - 3 * 86400;
  const u = 'https://hn.algolia.com/api/v1/search_by_date?tags=show_hn&numericFilters=created_at_i%3E' + since + '&hitsPerPage=50';
  const r = await fetch(u); const j = await r.json();
  return (j.hits || []).filter(h => h.title).slice(0, 50);
}

function loadProspects() { try { return JSON.parse(fs.readFileSync(path.join(DATA, 'prospects.json'), 'utf8')); } catch { return { byId: {} }; } }
function saveProspects(p) { fs.writeFileSync(path.join(DATA, 'prospects.json.tmp'), JSON.stringify(p)); fs.renameSync(path.join(DATA, 'prospects.json.tmp'), path.join(DATA, 'prospects.json')); }

(async () => {
  const hits = await fetchHN();
  const store = loadProspects();
  let nieuw = 0;
  for (const h of hits) {
    const id = 'hn_' + h.objectID;
    const bestaand = store.byId[id];
    if (bestaand && (bestaand.score > 0 || (bestaand.pogingen || 1) >= 3)) continue;
    if (nieuw >= PER_RUN) break;
    let score = 0, why = '', email = '', lastErr = ''; const pogingen = (bestaand && bestaand.pogingen || 0) + 1;
    try {
      const prompt = 'Je bent lead-kwalificeerder voor OrionX-AI (Nederlands SaaS: autonome AI-agents voor kleine bedrijven, EUR19-149/mnd). ' +
        'Beoordeel deze Show-HN post op kans dat de maker betaalt voor AI-automatisering van eigen operations. Antwoord ALLEEN met JSON: ' +
        '{"score":0-100,"why":"max 15 woorden"}\n Titel: ' + h.title + '\n Text: ' + String(h.comment_text || h.story_text || '').slice(0, 300);
      const raw = await vertexAsk(prompt);
      let m = raw.match(/\{[\s\S]*\}/);
      if (m) { try { const o = JSON.parse(m[0]); score = Number(o.score) || 0; why = String(o.why || '').slice(0, 120); } catch (e) {} }
      if (score === 0) {
        const sm = raw.match(/"score"\s*:\s*(\d{1,3})/);
        if (sm) score = Math.min(100, Number(sm[1]));
        const wm = raw.match(/"why"\s*:\s*"([^"]{0,120})/);
        if (wm && !why) why = wm[1];
        if (score === 0) lastErr = raw.slice(0, 90).replace(/\s+/g, ' ');
      }
    } catch (e) { /* vertex hiccup: bewaar ongescoord */ }
    store.byId[id] = {
      id, bron: 'HN Show', titel: h.title.slice(0, 160),
      url: h.url || ('https://news.ycombinator.com/item?id=' + h.objectID),
      maker: h.author || '', email, score, why, pogingen, err: lastErr,
      ts: new Date().toISOString(), status: 'te-benaderen'
    };
    nieuw++;
  }
  saveProspects(store);
  const top = Object.values(store.byId).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5);
  console.log('hunter klaar: +' + nieuw + ' prospects | top:', top.map(t => t.score + ' ' + t.titel.slice(0, 40)).join(' | '));
})().catch(e => { console.error('hunter FOUT:', e.message); process.exit(1); });
