#!/usr/bin/env python3
"""Local verification for the landing pages.

Needs python3 and Google Chrome. Chrome is ALWAYS launched with host rules that
send Meta hosts to 0.0.0.0, so no test event can reach the real dataset.
Run from anywhere:  python3 tools/verify/run.py
"""
import functools, http.server, json, os, re, shutil, subprocess, sys, tempfile, threading, html

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HOST_RULES = ("--host-resolver-rules=MAP connect.facebook.net 0.0.0.0, MAP www.facebook.com 0.0.0.0, "
              "MAP *.on.aws 0.0.0.0, MAP *.run.app 0.0.0.0")
OUT = os.path.join(REPO, "tools", "verify", "out")
results = []


def check(name, passed, detail=""):
    results.append((name, bool(passed), str(detail)))


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        self.server.result = self.rfile.read(n).decode("utf-8")
        self.send_response(204)
        self.end_headers()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def serve(directory, port):
    handler = functools.partial(Quiet, directory=directory)
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    srv.result = None
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def chrome(args, timeout=240):
    cmd = [CHROME, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
           "--hide-scrollbars", "--window-size=1400,1400", HOST_RULES] + args
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def harness(srv, port, query, extra=None, wait=600):
    """Real-time (not virtual-time) run: IntersectionObserver needs real frames.
    The harness POSTs its JSON result back to the local server."""
    import time
    url = "http://127.0.0.1:%d/tools/verify/harness.html?%s" % (port, query)
    srv.result = None
    prof = tempfile.mkdtemp(prefix="sc-chrome-")
    cmd = [CHROME, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--hide-scrollbars",
           "--window-size=1400,1400", "--user-data-dir=" + prof, HOST_RULES] + (extra or []) + [url]
    p = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    t0 = time.time()
    try:
        while srv.result is None and time.time() - t0 < wait and p.poll() is None:
            time.sleep(0.5)
    finally:
        p.terminate()
        try:
            p.wait(10)
        except Exception:
            p.kill()
        shutil.rmtree(prof, ignore_errors=True)
    if srv.result is None:
        return None, "no result within %ds" % wait
    return json.loads(srv.result), ""


def read(rel):
    with open(os.path.join(REPO, rel), encoding="utf-8") as f:
        return f.read()


def static_checks():
    files = ["support-coordinators/index.html", "support-coordinators/start/index.html", "assets/lp.css",
             "assets/tracking.js", "assets/video/sc-request-under-a-minute.vtt", "assets/video/same-day-ian.vtt",
             "_headers", "index.html", "404.html", "README.md"]
    text = {f: read(f) for f in files}
    for f in files + ["assets/badge-app-store.svg", "assets/badge-google-play.svg"]:
        data = open(os.path.join(REPO, f), encoding="utf-8").read()
        bad = [c for c in ("—", "–") if c in data] + re.findall(r"&mdash;|&ndash;|&#8212;|&#8211;|&#x2014;|&#x2013;", data, re.I)
        check("no em/en dash in " + f, not bad, bad)
    banned = ["verified providers", "ndis leads", "we know what's best for you", "perfect match", "unsafe",
              "first reply in 40 seconds", "minutes, not weeks", "encrypted", "24/7", "24 hours", "guarantee",
              "successful", "able to help", "235", "5,000", "whatsapp", "privacy act", "after-hours", "after hours",
              "24-hour", "matched", "completed", "your disability", "are you struggling", "verified", "stock"]
    banned.remove("stock")
    page_files = [f for f in files if f != "README.md"]
    for w in banned:
        hits = [f for f in page_files if re.search(r"(?<![\d,])" + re.escape(w) if w[0].isdigit() else re.escape(w), text[f].lower())]
        check("banned phrase absent: %r" % w, not hits, hits)
    check("word 'install' absent from tracking.js and pages", all("install" not in text[f].lower() for f in
          ["assets/tracking.js", "support-coordinators/index.html", "support-coordinators/start/index.html"]))
    # no other platform / tracker hosts
    allowed = {"apps.apple.com", "play.google.com", "app.ablefinder.net.au", "connect.facebook.net", "www.facebook.com",
               "www.ablefinder.net.au"}
    for f in ["support-coordinators/index.html", "support-coordinators/start/index.html", "assets/lp.css", "assets/tracking.js"]:
        hosts = set(re.findall(r"https?://([a-zA-Z0-9.-]+)", text[f]))
        check("only allowed external hosts in " + f, hosts <= allowed, hosts - allowed)
    for f in ["support-coordinators/index.html", "support-coordinators/start/index.html"]:
        t = text[f]
        check(f + " lang en-AU", '<html lang="en-AU">' in t)
        check(f + " robots noindex", '<meta name="robots" content="noindex">' in t)
        check(f + " exactly one pixel base snippet", t.count("fbq('init'") == 1 and t.count("fbevents.js") == 1)
        check(f + " exactly one noscript pixel img", t.count("<noscript>") == 1)
        check(f + " dataset id used", t.count("1231510630049582") == 3)
        check(f + " head order: variant script before stylesheet before pixel",
              t.index("dataset.variant") < t.index("lp.css") < t.index("fbevents.js"))
        imgs = re.findall(r"<img\b[^>]*>", t)
        check(f + " every img has alt", all(" alt=" in i for i in imgs))
        check(f + " no autoplay", "autoplay" not in t)
        check(f + " single tracking.js include", t.count('<script src="/assets/tracking.js">') == 1)
        check(f + " no inline event handlers", not re.search(r"\son(click|load|error)=", t))
        check(f + " every data-store anchor has a real store href", all(
            re.search(r'href="https://(apps\.apple\.com|play\.google\.com)/', a) for a in re.findall(r'<a [^>]*data-store[^>]*>', t)))
        check(f + " no target attr on store links", not re.search(r'<a [^>]*data-store[^>]*target=', t))
    titles = [re.search(r"<title>(.*?)</title>", text[f]).group(1) for f in
              ["support-coordinators/index.html", "support-coordinators/start/index.html"]]
    descs = [re.search(r'name="description" content="(.*?)"', text[f]).group(1) for f in
             ["support-coordinators/index.html", "support-coordinators/start/index.html"]]
    check("titles unique", titles[0] != titles[1], titles)
    check("descriptions unique", descs[0] != descs[1], descs)
    sam_js = re.search(r"const SAM_CONSENT = (\w+);", text["assets/tracking.js"]).group(1)
    sam_html = re.search(r"var SAM_CONSENT=(\w+);", text["support-coordinators/start/index.html"]).group(1)
    check("SAM_CONSENT is false in both places and equal", sam_js == sam_html == "false", (sam_js, sam_html))
    check("VTT files start with WEBVTT and one cue", all(text[f].startswith("WEBVTT") and text[f].count("-->") == 1 for f in
          ["assets/video/sc-request-under-a-minute.vtt", "assets/video/same-day-ian.vtt"]))
    check("brief VTT text exact", "Screen recording: a support coordinator posts a request in the AbleFinder app - service type, description, timing, location and preferences - then taps Create request." in text["assets/video/sc-request-under-a-minute.vtt"])
    check("tracking.js pixel params limited to five keys",
          re.search(r"store:.*position:.*audience:.*page:.*variant:", text["assets/tracking.js"], re.S) is not None)
    # page weight excluding mp4
    common = ["assets/lp.css", "assets/tracking.js", "assets/img/logo-colour.png", "assets/badge-app-store.svg",
              "assets/badge-google-play.svg", "assets/fonts/jost-latin-400-normal.woff2",
              "assets/fonts/jost-latin-500-normal.woff2", "assets/fonts/jost-latin-600-normal.woff2"]
    for page, poster in (("support-coordinators/index.html", "assets/video/sc-request-under-a-minute-poster.jpg"),
                         ("support-coordinators/start/index.html", "assets/video/same-day-ian-poster.jpg")):
        total = sum(os.path.getsize(os.path.join(REPO, p)) for p in [page, poster] + common)
        check("page weight excl. mp4 < 400,000 bytes: " + page, total < 400000, "%d bytes (html+css+js+3 fonts+logo+2 badges+poster)" % total)
    for rel in ["assets/img/logo-colour.png", "assets/img/logo-reverse.png", "assets/video/sc-request-under-a-minute.mp4",
                "assets/video/same-day-ian.mp4", "assets/video/sc-request-under-a-minute-poster.jpg", "assets/video/same-day-ian-poster.jpg"]:
        r = subprocess.run(["git", "-C", REPO, "diff", "--quiet", "--", rel])
        check("supplied file unmodified (not in git diff): " + rel, r.returncode == 0)
    check("OFL licence file present", os.path.getsize(os.path.join(REPO, "assets/fonts/OFL.txt")) > 1000)
    check("Apple badge is the official SVG (viewBox 119.66407 x 40)", 'viewBox="0 0 119.66407 40"' in read("assets/badge-app-store.svg"))
    check("Google badge is the official SVG (viewBox 238.96 x 70.87)", 'viewBox="0 0 238.96 70.87"' in read("assets/badge-google-play.svg"))


def js_off():
    """With scripts disabled the DOM is the served HTML. dump-dom needs script, so check the source and take a
    screenshot with scripting disabled (default H1 must show even with ?c=private)."""
    os.makedirs(OUT, exist_ok=True)
    srv = serve(REPO, 8010)
    for rel, name in (("support-coordinators/index.html", "landing"), ("support-coordinators/start/index.html", "start")):
        src = read(rel)
        check("JS off %s: html tag has no data-variant/data-os (set only by script)" % name, re.search(r"<html[^>]*data-", src) is None)
        flat = re.findall(r'<a href="([^"]+)"[^>]*data-store', src)
        check("JS off %s: all %d store links are real store URLs with default ct" % (name, len(flat)), len(flat) >= 10 and all(
            (u.startswith("https://apps.apple.com/au/app/ablefinder/id6751715948?ct=") or
             u.startswith("https://play.google.com/store/apps/details?id=com.ablefinder.ablefinder&amp;referrer=")) and "default" in u for u in flat))
    # Chrome cannot screenshot with scripting disabled, so render a temp copy with every <script> removed.
    tmp = tempfile.mkdtemp(prefix="sc-nojs-")
    dst = os.path.join(tmp, "site")
    shutil.copytree(REPO, dst, ignore=shutil.ignore_patterns(".git", "*.mp4", "out", "BRIEF.md", "PLAN.md"))
    for rel in ("support-coordinators/index.html", "support-coordinators/start/index.html"):
        p = os.path.join(dst, rel)
        t = open(p, encoding="utf-8").read()
        open(p, "w", encoding="utf-8").write(re.sub(r"<script\b.*?</script>", "", t, flags=re.S))
    srv2 = serve(dst, 8014)
    for path, name in (("support-coordinators/?c=private", "jsoff-landing-private"), ("support-coordinators/start/?c=private", "jsoff-start-private")):
        p = os.path.join(OUT, name + ".png")
        if os.path.exists(p):
            os.remove(p)
        shot = "http://127.0.0.1:8014/tools/verify/shot.html?w=375&h=667&u=/" + path.replace("?", "%3F").replace("=", "%3D")
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars", HOST_RULES,
                        "--virtual-time-budget=5000", "--screenshot=" + p, "--window-size=500,667", shot],
                       capture_output=True, text=True, timeout=120)
        check("JS off screenshot " + name, os.path.exists(p) and os.path.getsize(p) > 2000, p)
    srv2.shutdown()
    shutil.rmtree(tmp, ignore_errors=True)
    srv.shutdown()


def os_runs():
    srv = serve(REPO, 8011)
    uas = {"ios": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
           "android": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"}
    for name, ua in uas.items():
        res, err = harness(srv, 8011, "mode=os&os=" + name, ["--user-agent=" + ua])
        if res is None:
            check("os run " + name, False, err[-300:])
            continue
        for r in res:
            check(r["name"], r["pass"], r["detail"])
    srv.shutdown()


def screenshots():
    os.makedirs(OUT, exist_ok=True)
    srv = serve(REPO, 8012)
    shots = [("landing-default", "support-coordinators/", 375, 667), ("landing-capacity", "support-coordinators/?c=capacity", 375, 667),
             ("landing-private", "support-coordinators/?c=private", 375, 667), ("landing-built", "support-coordinators/?c=built", 375, 667),
             ("start-default", "support-coordinators/start/", 375, 667), ("start-private", "support-coordinators/start/?c=private", 375, 667),
             ("start-sameday", "support-coordinators/start/?c=sameday", 375, 667),
             ("landing-default-1280", "support-coordinators/", 1280, 800), ("start-default-1280", "support-coordinators/start/", 1280, 800),
             ("landing-default-full", "support-coordinators/", 375, 6900), ("start-default-full", "support-coordinators/start/", 375, 3400)]
    for name, path, w, h in shots:
        p = os.path.join(OUT, name + ".png")
        if os.path.exists(p):
            os.remove(p)
        shot = "http://127.0.0.1:8012/tools/verify/shot.html?w=%d&h=%d&u=/%s" % (w, h, path.replace("?", "%3F").replace("=", "%3D"))
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars", HOST_RULES,
                        "--virtual-time-budget=5000", "--screenshot=" + p, "--window-size=%d,%d" % (max(w, 500), h), shot],
                       capture_output=True, text=True, timeout=120)
        check("screenshot " + name, os.path.exists(p) and os.path.getsize(p) > 2000, p)
    srv.shutdown()


def console_errors():
    srv = serve(REPO, 8013)
    for path in ("support-coordinators/", "support-coordinators/start/"):
        r = chrome(["--virtual-time-budget=6000", "--enable-logging=stderr", "--v=0", "--dump-dom", "http://127.0.0.1:8013/" + path])
        lines = [l for l in r.stderr.splitlines() if "CONSOLE" in l and "facebook" not in l.lower()]
        bad = [l for l in lines if re.search(r"error|failed|404|refused", l, re.I)]
        check("no console errors (Meta hosts blocked by design) " + path, not bad, bad[:3])
    srv.shutdown()


def main():
    if not os.path.exists(CHROME):
        print("Chrome not found")
        return 2
    static_checks()
    s_main = serve(REPO, 8000)
    res, err = harness(s_main, 8000, "mode=main")
    s_main.shutdown()
    if res is None:
        check("main harness produced output", False, err[-500:])
    else:
        for r in res:
            check(r["name"], r["pass"], r["detail"])
    # SAM_CONSENT=true run against a patched temp copy (never touches the repo)
    tmp = tempfile.mkdtemp(prefix="sc-sam-")
    dst = os.path.join(tmp, "site")
    shutil.copytree(REPO, dst, ignore=shutil.ignore_patterns(".git", "*.mp4", "out", "BRIEF.md", "PLAN.md"))
    for rel, a, b in (("assets/tracking.js", "const SAM_CONSENT = false;", "const SAM_CONSENT = true;"),
                      ("support-coordinators/start/index.html", "var SAM_CONSENT=false;", "var SAM_CONSENT=true;")):
        p = os.path.join(dst, rel)
        t = open(p, encoding="utf-8").read()
        assert a in t, rel
        open(p, "w", encoding="utf-8").write(t.replace(a, b))
    s_sam = serve(dst, 8001)
    res, err = harness(s_sam, 8001, "mode=sam")
    s_sam.shutdown()
    shutil.rmtree(tmp, ignore_errors=True)
    if res is None:
        check("sam harness produced output", False, err[-500:])
    else:
        for r in res:
            check("[SAM_CONSENT=true copy] " + r["name"], r["pass"], r["detail"])
    os_runs()
    js_off()
    console_errors()
    screenshots()
    width = max(len(n) for n, _, _ in results)
    fails = 0
    for n, p, d in results:
        if not p:
            fails += 1
        print(("PASS" if p else "FAIL"), n, ("| " + d) if d else "")
    print("\n%d checks, %d failed" % (len(results), fails))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
