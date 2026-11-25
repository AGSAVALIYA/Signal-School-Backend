// Renders build/timeline.json to video: N parallel workers, each steps the page clock frame by frame and pipes
// screenshots (only when something changed) into ffmpeg; then segments + narration are joined.
// Usage: node render.mjs [--workers 3] [--from s --to s] [--out name]
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { serve, boot } from './lib.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const FPS = 30;
const FRAME = 1000 / FPS;
const tl = JSON.parse(readFileSync('build/timeline.json', 'utf8'));
const from = Math.round(((Number(args.from) || 0) * 1000) / FRAME);
const to = Math.round(((args.to ? Number(args.to) : tl.duration / 1000) * 1000) / FRAME);
const workers = Number(args.workers || 3);
const out = args.out || 'walkthrough';
const CLOCK = new Date('2026-11-25T11:42:00').getTime();
mkdirSync('build/seg', { recursive: true });

async function renderSegment(k, f0, f1, url) {
  const file = `build/seg/${out}-${k}.mp4`;
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-r', String(FPS), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const { browser, page } = await boot(url, { actions: tl.actions, t0: f0 * FRAME, clock: CLOCK, mouse: { x: 1180, y: 610 } });
  const cdp = await page.context().newCDPSession(page);
  let last = null;
  let shots = 0;
  const started = Date.now();
  for (let f = f0; f < f1; f += 1) {
    const { dirty } = await page.evaluate((ms) => window.__step(ms), FRAME);
    if (dirty || !last) {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 93, optimizeForSpeed: true, clip: { x: 0, y: 0, width: 1600, height: 900, scale: 1.2 } });
      last = Buffer.from(data, 'base64');
      shots += 1;
    }
    if (!ff.stdin.write(last)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((f - f0) % 900 === 0) console.log(`[w${k}] ${(((f - f0) / (f1 - f0)) * 100).toFixed(0)}%  frame ${f}  shots ${shots}  ${((Date.now() - started) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
  console.log(`[w${k}] done ${file} (${shots} captures, ${((Date.now() - started) / 1000).toFixed(0)}s)`);
  return file;
}

function buildAudio(t0, t1) {
  const RATE = 48000;
  const total = Math.ceil(((t1 - t0) / 1000) * RATE);
  const pcm = new Int16Array(total);
  for (const c of tl.clips) {
    const raw = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', c.file, '-f', 's16le', '-ac', '1', '-ar', String(RATE), '-'], { maxBuffer: 1 << 30 });
    const samples = new Int16Array(raw.buffer, raw.byteOffset, raw.length / 2);
    const off = Math.round(((c.at - t0) / 1000) * RATE);
    for (let i = 0; i < samples.length; i += 1) {
      const j = off + i;
      if (j >= 0 && j < total) pcm[j] = samples[i];
    }
  }
  writeFileSync('build/narration.raw', Buffer.from(pcm.buffer));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 's16le', '-ar', String(RATE), '-ac', '1', '-i', 'build/narration.raw', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', String(RATE), '-ac', '2', 'build/narration.wav']);
}

const { srv, url } = await serve();
const n = to - from;
const per = Math.ceil(n / workers);
const segs = await Promise.all(Array.from({ length: workers }, (_, k) => renderSegment(k, from + k * per, Math.min(to, from + (k + 1) * per), url)));
srv.close();
writeFileSync('build/seg/list.txt', segs.map((s) => `file '${s.replace('build/seg/', '')}'`).join('\n'));
buildAudio(from * FRAME, to * FRAME);
mkdirSync('output', { recursive: true });
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'build/seg/list.txt', '-i', 'build/narration.wav', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', `output/${out}.mp4`]);
console.log(`wrote output/${out}.mp4`);
