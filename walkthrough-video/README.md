# Code walkthrough video

`output/Signal-School-Code-Walkthrough-compact.mp4` — 1920×1080, 30 fps, ~28 min, Indian-English voice-over.
Chapters: `output/chapters.txt`. (The full-quality master, 162 MB, is above GitHub's 100 MB file limit; this copy is re-encoded at 98 MB.)

The video is generated, not screen-recorded, so it can be rebuilt exactly after the code changes:

| File | What |
|---|---|
| `script.mjs` | Narration per scene and what happens on screen (open file, select lines, quick open, terminal…). `{a}` in the text marks the word an action is timed to |
| `prepare.mjs` | Tokenizes both repos with Shiki (VS Code's grammars, Dark+ colours, bracket-pair colours) → `data/` |
| `build.mjs` + `tts.py` | Voice clips (Microsoft neural voice `en-IN-PrabhatNeural`, with word timings) → `build/timeline.json` |
| `engine/` | VS Code (macOS, Dark Modern) replica driven by a deterministic clock, macOS cursor, section banners |
| `render.mjs` | Steps the clock frame by frame in Chromium, pipes frames to ffmpeg, adds the narration |
| `termlogs/` | Real output of `npm test` in both repos, replayed in the terminal panel |

```bash
npm i && pip install edge-tts
node prepare.mjs && node build.mjs && node render.mjs --workers 3 --out Signal-School-Code-Walkthrough
```
`node render.mjs --from 40 --to 70 --out test` renders a short excerpt; `node check.mjs` reports actions that start late.
Other voices: `VOICE=en-IN-NeerjaNeural node build.mjs` (female), `RATE=+5%` to speak faster.
