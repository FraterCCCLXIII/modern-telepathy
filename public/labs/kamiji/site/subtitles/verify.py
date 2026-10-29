# Playwright check of the demo: python3 site/subtitles/verify.py  (starts a server rooted at the repo root on 127.0.0.1:8792)
import subprocess, sys, time, os, json
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = "/private/tmp/claude-501/subtitles"; os.makedirs(OUT, exist_ok=True)
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8792", "--bind", "127.0.0.1"], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
problems = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
        for w, h in [(1440, 900), (1024, 768), (375, 812)]:
            ctx = b.new_context(viewport={"width": w, "height": h}); pg = ctx.new_page(); errs = []
            pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.on("requestfailed", lambda r: errs.append("requestfailed " + r.url) if "127.0.0.1" in r.url else None)
            pg.goto("http://127.0.0.1:8792/site/subtitles/", wait_until="networkidle")
            pg.evaluate("__subs.seek(3800)")
            pg.screenshot(path=f"{OUT}/{w}-top.png")
            st = pg.locator("#stage")
            st.scroll_into_view_if_needed()
            shots = [("classic", 3800), ("boxed", 3800), ("karaoke", 4300), ("bubble", 3800), ("cinematic", 7600), ("typewriter", 7600)]
            for style, t in shots:
                pg.evaluate(f"__subs.setStyle('{style}'); __subs.seek({t})"); pg.wait_for_timeout(250)
                st.screenshot(path=f"{OUT}/{w}-{style}.png")
            # overlap + os + sfx
            pg.evaluate("__subs.setStyle('classic'); __subs.seek(13800)"); pg.wait_for_timeout(250); st.screenshot(path=f"{OUT}/{w}-overlap.png")
            for lang, t in [("ja", 7600), ("ar", 7600)]:
                pg.evaluate(f"__subs.setLanguage('{lang}'); __subs.seek({t})"); pg.wait_for_timeout(250); st.screenshot(path=f"{OUT}/{w}-{lang}.png")
            pg.evaluate("__subs.setLanguage('en')")
            pg.evaluate("__subs.seek(3800); window.scrollTo(0,0)"); pg.wait_for_timeout(300); pg.screenshot(path=f"{OUT}/{w}-full.png", full_page=True)
            sw = pg.evaluate("[document.documentElement.scrollWidth, innerWidth]")
            if sw[0] > sw[1]: problems.append(f"{w}: horizontal scroll {sw}")
            # behaviour checks (1440 only)
            if w == 1440:
                # rapid seeks
                t0 = pg.evaluate("(() => { const t=performance.now(); for (let i=0;i<2000;i++) __subs.seek((i*997)%24000); return performance.now()-t; })()")
                print("2000 seeks ms:", round(t0, 1))
                if t0 > 800: problems.append(f"seeks slow {t0}")
                # export / import round trip through the UI
                pg.evaluate("__subs.seek(0)")
                pg.click("[data-exp=vtt]"); vtt = pg.input_value("#io"); assert vtt.startswith("WEBVTT"), vtt[:20]
                pg.click("[data-exp=srt]"); srt = pg.input_value("#io"); assert "KAMI:" in srt
                pg.fill("#io", srt); pg.click("#b-load-text"); print("status:", pg.inner_text("#io-status"))
                pg.fill("#io", "garbage\n\n1\nnot time\nx"); pg.click("#b-load-text"); print("bad import:", pg.inner_text("#io-status"))
                # play for a moment, check events and mirror
                pg.evaluate("__subs.setTimeline(" + json.dumps([{"id":"x","characterId":"kami","text":"Hello there.","startMs":0,"durationMs":2000}]) + ");")
                pg.evaluate("window.__ev=[]; __subs.on('wordStart', e=>__ev.push(e.index)); __subs.on('talking', e=>__ev.push('t'+e.amplitude.toFixed(1))); __subs.play(null,{from:0})")
                pg.wait_for_timeout(1500); ev = pg.evaluate("__ev"); print("events:", ev[:12]); assert any(isinstance(x, int) for x in ev), ev
                print("mirror:", repr(pg.evaluate("document.querySelector('.kmj-sr').textContent")))
                pg.evaluate("__subs.pause()")
                # persistence
                pg.evaluate("__subs.setSize(1.4); __subs.setBackgroundOpacity(0.3)"); pg.reload(wait_until="networkidle")
                print("persisted:", pg.evaluate("JSON.stringify(__subs.settings)"))
                pg.evaluate("__subs.resetSettings()")
            if errs: problems.append(f"{w}: console {errs}")
            ctx.close()
        b.close()
finally:
    srv.terminate()
print("PROBLEMS:", problems or "none")
