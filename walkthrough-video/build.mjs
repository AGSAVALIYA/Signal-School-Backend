// Builds the timeline: narration clips (TTS) + absolute action times, aligned to spoken words.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { SCENES } from './script.mjs';

const LEAD = 380; // actions start a little before their word, so the movement lands on it
const GAP = 650; // pause between scenes
mkdirSync('build', { recursive: true });

// ---- TTS ----
const clean = (say) => say.replace(/\{\w+\}/g, '').replace(/\s+/g, ' ').trim();
const jobs = SCENES.map((s) => ({ id: s.id, text: clean(s.say), hash: createHash('sha1').update(`${process.env.VOICE || ''}|${process.env.RATE || ''}|${clean(s.say)}`).digest('hex').slice(0, 16) }));
writeFileSync('build/tts-jobs.json', JSON.stringify(jobs));
execSync('python3 tts.py', { stdio: 'inherit' });

// ---- terminal output (real runs, ANSI -> HTML) ----
const FG = { 30: '#000000', 31: '#cd3131', 32: '#0dbc79', 33: '#e5e510', 34: '#2472c8', 35: '#bc3fbc', 36: '#11a8cd', 37: '#e5e5e5', 90: '#767676', 91: '#f14c4c', 92: '#23d18b', 93: '#f5f543', 94: '#3b8eea', 95: '#d670d6', 96: '#29b8db', 97: '#e5e5e5' };
const BG = Object.fromEntries(Object.entries(FG).map(([k, v]) => [Number(k) + 10, v]));
const escH = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function ansiToHtml(line) {
  let out = '';
  const st = { b: false, d: false, fg: null, bg: null };
  for (const part of line.split(/(\x1b\[[0-9;]*m)/)) {
    const m = part.match(/^\x1b\[([0-9;]*)m$/);
    if (m) {
      for (const c of (m[1] || '0').split(';').map(Number)) {
        if (c === 0) Object.assign(st, { b: false, d: false, fg: null, bg: null });
        else if (c === 1) st.b = true;
        else if (c === 2) st.d = true;
        else if (c === 22) st.b = st.d = false;
        else if (c === 39) st.fg = null;
        else if (c === 49) st.bg = null;
        else if (FG[c]) st.fg = FG[c];
        else if (BG[c]) st.bg = BG[c];
      }
      continue;
    }
    if (!part) continue;
    const css = [st.fg && `color:${st.fg}`, st.bg && `background:${st.bg}`, st.b && 'font-weight:700', st.d && 'opacity:.6'].filter(Boolean).join(';');
    out += css ? `<span style="${css}">${escH(part)}</span>` : escH(part);
  }
  return out;
}
const termLines = (file) =>
  readFileSync(file, 'utf8')
    .replace(/\/home\/user\//g, '/Users/dev/Projects/')
    .replace(/\r/g, '')
    .replace(/\n+$/, '')
    .split('\n')
    .map(ansiToHtml);

function beTest(fitMs) {
  const lines = termLines('termlogs/backend-npm-test.ansi');
  // Real per-file times (s) scaled to fit the narration; quick lines for the rest.
  const weights = lines.map((l) => {
    const t = l.match(/PASS.*?\(([\d.]+) s\)/);
    if (t) return Number(t[1]);
    if (/PASS/.test(l)) return 2.2;
    return 0;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  const budget = Math.max(3000, fitMs - 1200);
  return lines.map((l, i) => [l, weights[i + 1] ? (weights[i + 1] / total) * budget : 45]);
}
function feTest() {
  const lines = termLines('termlogs/frontend-npm-test.ansi');
  return lines.map((l) => [l, /RUN/.test(l) ? 900 : /✓/.test(l) ? 140 : 40]);
}

// ---- timeline ----
const actions = [];
const clips = [];
let t = 0;
const norm = (w) => w.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
for (const [si, s] of SCENES.entries()) {
  const job = jobs[si];
  const meta = JSON.parse(readFileSync(`audio/${job.hash}.json`, 'utf8'));
  const lead = s.lead || 0;
  const start = t;
  const voiceAt = start + lead;
  clips.push({ id: s.id, file: `audio/${job.hash}.mp3`, at: voiceAt, duration: meta.duration });

  // marker -> spoken time
  const markers = {};
  const wordsBefore = [];
  const re = /\{(\w+)\}|([\p{L}\p{N}]+(?:['’][\p{L}]+)?)/gu;
  let m;
  let count = 0;
  const pending = [];
  while ((m = re.exec(s.say))) {
    if (m[1]) pending.push(m[1]);
    else {
      for (const name of pending) markers[name] = { index: count, word: m[2] };
      pending.length = 0;
      wordsBefore.push(m[2]);
      count += 1;
    }
  }
  for (const name of pending) markers[name] = { index: count, word: null, end: true };
  const W = meta.words;
  let cursor = 0;
  const markerTime = {};
  for (const [name, mk] of Object.entries(markers).sort((a, b) => a[1].index - b[1].index)) {
    if (mk.end || !W.length) {
      markerTime[name] = meta.duration;
      continue;
    }
    const expected = Math.round((mk.index / Math.max(1, count)) * W.length);
    let best = -1;
    let bestD = 1e9;
    for (let k = Math.max(cursor, expected - 12); k < Math.min(W.length, expected + 12); k += 1) {
      const a = norm(W[k].w);
      const b = norm(mk.word);
      if (a && b && (a === b || a.startsWith(b) || b.startsWith(a))) {
        const d = Math.abs(k - expected);
        if (d < bestD) (bestD = d), (best = k);
      }
    }
    if (best < 0) {
      console.warn(`marker ${s.id}:${name} "${mk.word}" not matched; using estimate`);
      best = Math.min(W.length - 1, Math.max(cursor, expected));
    }
    cursor = best;
    markerTime[name] = W[best].t;
  }

  for (const [when, act] of s.acts) {
    let at;
    if (when === null) at = start;
    else if (typeof when === 'number') at = start + when;
    else {
      if (markerTime[when] === undefined) throw new Error(`scene ${s.id}: unknown marker ${when}`);
      at = Math.max(start, voiceAt + markerTime[when] - LEAD);
    }
    const a = { ...act, at: Math.round(at), scene: s.id, tagged: typeof when === 'string' };
    if (a.do === 'termOut' && a.lines === 'BE_TEST') a.lines = beTest(meta.duration);
    if (a.do === 'termOut' && a.lines === 'FE_TEST') a.lines = feTest();
    actions.push(a);
  }
  t = voiceAt + meta.duration + (s.pad ?? GAP);
}
const duration = Math.ceil(t / (1000 / 30)) * (1000 / 30);
writeFileSync('build/timeline.json', JSON.stringify({ actions, clips, duration }, null, 1));
console.log(`timeline: ${(duration / 60000).toFixed(2)} min, ${actions.length} actions, ${clips.length} clips`);
for (const c of clips) console.log(`  ${c.id.padEnd(20)} ${(c.at / 1000).toFixed(1).padStart(7)}s  ${(c.duration / 1000).toFixed(1)}s`);
