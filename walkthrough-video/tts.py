"""Generates one narration clip per scene with Microsoft's en-IN neural voice, plus word timings.
Input: build/tts-jobs.json  [{id, text, hash}]  ->  audio/<hash>.mp3 + audio/<hash>.json (word boundaries, duration)."""
import asyncio, json, os, subprocess, sys
import certifi
certifi.where = lambda: "/root/.ccr/ca-bundle.crt"
import edge_tts

VOICE = os.environ.get("VOICE", "en-IN-PrabhatNeural")
RATE = os.environ.get("RATE", "-2%")

async def one(job):
    mp3 = f"audio/{job['hash']}.mp3"
    meta = f"audio/{job['hash']}.json"
    if os.path.exists(mp3) and os.path.exists(meta):
        return
    words = []
    for attempt in range(8):
        try:
            c = edge_tts.Communicate(job["text"], VOICE, rate=RATE, boundary="WordBoundary")
            words = []
            with open(mp3 + ".tmp", "wb") as f:
                async for chunk in c.stream():
                    if chunk["type"] == "audio":
                        f.write(chunk["data"])
                    elif chunk["type"] == "WordBoundary":
                        words.append({"t": chunk["offset"] / 1e4, "d": chunk["duration"] / 1e4, "w": chunk["text"]})
            if os.path.getsize(mp3 + ".tmp") > 1000:
                break
        except Exception as e:  # network hiccup: retry
            print("retry", job["id"], e, file=sys.stderr)
            await asyncio.sleep(20 + attempt * 15)
    else:
        raise SystemExit(f"TTS failed for {job['id']}")
    os.replace(mp3 + ".tmp", mp3)
    dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3]).decode().strip()) * 1000
    json.dump({"words": words, "duration": dur}, open(meta, "w"))
    await asyncio.sleep(2)
    print("tts", job["id"], round(dur / 1000, 1), "s", len(words), "words")

async def main():
    os.makedirs("audio", exist_ok=True)
    jobs = json.load(open("build/tts-jobs.json"))
    sem = asyncio.Semaphore(1)
    async def run(j):
        async with sem:
            await one(j)
    await asyncio.gather(*(run(j) for j in jobs))

asyncio.run(main())
