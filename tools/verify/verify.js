/* In-browser checks. Loaded by harness.html. Query: ?mode=main|sam|os&consent=0|1 */
(function () {
  "use strict";
  var P = new URLSearchParams(location.search);
  var MODE = P.get("mode") || "main";
  var R = [];
  function ok(name, pass, detail) { document.getElementById("out").textContent = "PENDING after: " + name; R.push({ name: name, pass: !!pass, detail: detail === undefined ? "" : String(detail) }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function frames() { return sleep(50); } /* rAF is unreliable in headless virtual time */
  function norm(s) { return (s || "").replace(/\s+/g, " ").trim(); }

  var LAND = "/support-coordinators/";
  var START = "/support-coordinators/start/";

  var LAND_H1 = {
    "": "Stop chasing capacity. Post the need once - providers who can take it on come to you.",
    capacity: "Need capacity? Post it once. Stop sending the same email forty times.",
    "private": "Anonymous by default. Your details stay private until you're ready.",
    built: "250+ events. 15,000+ connections. Then we built the app."
  };
  var LAND_FIRST = { "": "recording", capacity: "week", "private": "privacy", built: "built" };
  var START_H1 = {
    "": "Our fastest reply so far: 40 seconds. Post yours in under a minute.",
    sameday: "Months of searching. Sorted the same day.",
    "private": "Your participant's name stays private. Until you choose who sees it.",
    fair: "Nobody can pay more to be seen first. A fair playing field for all.",
    free: "Free. One post. Under a minute.",
    tonight: "Post it tonight. Read your replies tomorrow."
  };
  var DAYS_H1 = "\"My participant started therapy within days.\" - Sam, support coordinator, Illawarra";
  var CONSENT = MODE === "sam" || P.get("consent") === "1"; /* mirrors SAM_CONSENT in the repo */
  if (CONSENT) { START_H1.days = DAYS_H1; }

  function load(path, w, h) {
    document.getElementById("out").textContent = "PENDING loading " + path;
    return new Promise(function (res) {
      var f = document.createElement("iframe");
      f.style.width = w + "px"; f.style.height = h + "px";
      f.onload = function () { setTimeout(function () { res(f); }, 200); };
      f.src = path;
      document.body.appendChild(f);
    });
  }
  function jump(w, y) { w.scrollTo({ top: y, left: 0, behavior: "instant" }); }
  function drop(f) { if (f && f.parentNode) { f.parentNode.removeChild(f); } }
  function shown(el) { return !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden"; }
  function visibleH1s(d) {
    return Array.prototype.filter.call(d.querySelectorAll("h1"), function (h) { return shown(h); });
  }
  function bottomOf(el) { return el.getBoundingClientRect().bottom; }

  async function h1Checks(base, table, label, daysExpectDays) {
    var keys = Object.keys(table);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var f = await load(base + (k ? "?c=" + k : ""), 375, 667);
      var d = f.contentDocument;
      var v = visibleH1s(d);
      ok(label + " ?c=" + (k || "(none)") + " one visible H1 with exact text",
         v.length === 1 && norm(v[0].textContent) === table[k], v.length + " | " + (v[0] ? norm(v[0].textContent) : ""));
      var lede = Array.prototype.some.call(d.querySelectorAll(".hero .lede"), function (p) {
        return norm(p.textContent) === "AbleFinder is a free app for support coordinators, participants and carers." && shown(p); });
      ok(label + " ?c=" + (k || "(none)") + " lede line present", lede);
      drop(f);
    }
    var junk = ["nonsense", "DAYS_X", "%3Cb%3E"];
    for (var j = 0; j < junk.length; j++) {
      var f2 = await load(base + "?c=" + junk[j], 375, 667);
      var v2 = visibleH1s(f2.contentDocument);
      ok(label + " ?c=" + junk[j] + " shows default H1", v2.length === 1 && norm(v2[0].textContent) === table[""], v2.length ? norm(v2[0].textContent) : "none");
      drop(f2);
    }
    var fd = await load(base + "?c=days", 375, 667);
    var vd = visibleH1s(fd.contentDocument);
    if (daysExpectDays) {
      ok(label + " ?c=days shows Sam H1 (SAM_CONSENT true)", vd.length === 1 && norm(vd[0].textContent) === DAYS_H1, vd[0] ? norm(vd[0].textContent) : "none");
    } else {
      ok(label + " ?c=days shows default H1 (SAM_CONSENT false)", vd.length === 1 && norm(vd[0].textContent) === table[""], vd[0] ? norm(vd[0].textContent) : "none");
    }
    drop(fd);
    var fu = await load(base + "?c=DAYS", 375, 667);
    var vu = visibleH1s(fu.contentDocument);
    ok(label + " ?c=DAYS (upper case) handled like days", vu.length === 1 && norm(vu[0].textContent) === (daysExpectDays ? DAYS_H1 : table[""]));
    drop(fu);
  }

  async function foldChecks(base, table, label) {
    var keys = Object.keys(table);
    var worst = 0;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var f = await load(base + (k ? "?c=" + k : ""), 375, 667);
      var d = f.contentDocument;
      var bs = Array.prototype.filter.call(d.querySelectorAll("#hero .store-badge"), shown);
      var b = bs.length ? Math.max.apply(null, bs.map(bottomOf)) : 9999;
      var h1b = bottomOf(visibleH1s(d)[0]);
      worst = Math.max(worst, b);
      ok(label + " 375x667 ?c=" + (k || "(none)") + " hero badges fully above fold", bs.length >= 1 && b <= 667, "badge bottom " + Math.round(b) + "px (h1 bottom " + Math.round(h1b) + ")");
      ok(label + " 375x667 ?c=" + (k || "(none)") + " hero badge bottom <= 460 (plan target)", b <= 460, Math.round(b) + "px");
      var card = d.querySelector(".request-card");
      if (card) { ok(label + " ?c=" + (k || "(none)") + " example card not above badges", card.getBoundingClientRect().top >= Math.max.apply(null, bs.map(bottomOf))); }
      drop(f);
    }
    return worst;
  }

  async function widthChecks(base, table, label) {
    var keys = Object.keys(table);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var f = await load(base + (k ? "?c=" + k : ""), 360, 640);
      var d = f.contentDocument;
      var btn = d.getElementById("participant-btn");
      if (btn) { btn.click(); }
      await frames();
      var de = d.documentElement;
      ok(label + " 360px no horizontal scroll ?c=" + (k || "(none)"), de.scrollWidth <= 360 && d.body.scrollWidth <= 360, "scrollWidth " + de.scrollWidth);
      drop(f);
    }
  }

  function setHrefsInert(d) {
    Array.prototype.forEach.call(d.querySelectorAll("a[data-store],a[data-webapp]"), function (a) { a.setAttribute("href", "#noop"); });
  }
  function clickEv(w, el) {
    var ev = new w.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    el.dispatchEvent(ev);
    return ev;
  }
  function events(w, name) {
    return Array.prototype.filter.call(w.fbq.queue || [], function (a) { return a[0] === "trackCustom" && a[1] === name; })
      .map(function (a) { return { params: a[2], opts: a[3] }; });
  }

  function stubZaraz(w) { w.__z = []; w.zaraz = { track: function (n, p) { w.__z.push([n, p]); } }; }
  function zEvents(w, name) { return (w.__z || []).filter(function (e) { return e[0] === name; }); }

  async function trackingChecks(base, page, variant, label) {
    var url = base + (variant ? "?c=" + variant : "");
    var vname = variant || "default";
    var f = await load(url, 1280, 900);
    var d = f.contentDocument, w = f.contentWindow;
    var pv = Array.prototype.filter.call(w.fbq.queue || [], function (a) { return a[0] === "track" && a[1] === "PageView"; }).length;
    ok(label + " exactly one PageView in queue", pv === 1, pv);
    var scripts = d.querySelectorAll("script[src*='fbevents.js']").length;
    ok(label + " exactly one fbevents.js script element", scripts === 1, scripts);
    ok(label + " real fbevents.js did not load (Meta hosts blocked)", typeof w.fbq.callMethod === "undefined");
    var inits = Array.prototype.filter.call(w.fbq.queue || [], function (a) { return a[0] === "init"; });
    ok(label + " one init with dataset 1231510630049582", inits.length === 1 && inits[0][1] === "1231510630049582");
    var ac = Array.prototype.filter.call(w.fbq.queue || [], function (a) { return a[0] === "set" && a[1] === "autoConfig" && a[2] === false; });
    ok(label + " autoConfig false", ac.length === 1);
    drop(f);

    var positions = page === "sc-landing" ? ["header", "hero", "sticky", "final", "participant"] : ["header", "hero", "sticky", "final", "participant"];
    var stores = ["ios", "android"];
    for (var pi = 0; pi < positions.length; pi++) {
      for (var si = 0; si < stores.length; si++) {
        var pos = positions[pi], st = stores[si];
        var g = await load(url, 1280, 900);
        var gd = g.contentDocument, gw = g.contentWindow;
        var btn = gd.getElementById("participant-btn");
        if (pos === "participant") { btn.click(); }
        var a = gd.querySelector("a[data-store='" + st + "'][data-position='" + pos + "']");
        if (!a) { ok(label + " " + pos + "/" + st + " button exists", false); drop(g); continue; }
        var href = a.getAttribute("href");
        var ctWant = page + "-" + vname;
        var hrefOk = st === "ios"
          ? href.indexOf("https://apps.apple.com/au/app/ablefinder/id6751715948?pt=128092141&ct=") === 0 && href.indexOf("ct=" + ctWant + "&mt=8") > -1
          : href.indexOf("https://play.google.com/store/apps/details?id=com.ablefinder.ablefinder&referrer=") === 0 &&
            href.slice(-("utm_content%3D" + ctWant).length) === "utm_content%3D" + ctWant;
        ok(label + " " + pos + "/" + st + " store link carries ct " + ctWant, hrefOk, href);
        setHrefsInert(gd);
        stubZaraz(gw);
        var ev1 = clickEv(gw, a);
        var evs = events(gw, "DownloadApp");
        var p = evs.length ? evs[0].params : {};
        var keys = Object.keys(p).sort().join(",");
        var want = { store: st, position: pos, audience: pos === "participant" ? "participant_carer" : "coordinator", page: page, variant: vname };
        var good = evs.length === 1 && keys === "audience,page,position,store,variant";
        Object.keys(want).forEach(function (k) { if (p[k] !== want[k]) { good = false; } });
        ok(label + " " + pos + "/" + st + " one DownloadApp, five params correct", good, JSON.stringify(p) + " n=" + evs.length);
        ok(label + " " + pos + "/" + st + " eventID present and click default prevented", !!(evs[0] && evs[0].opts && evs[0].opts.eventID) && ev1.defaultPrevented);
        var zs = zEvents(gw, "app_store_click");
        var zp = zs.length ? zs[0][1] : {};
        var zwant = { store: st, position: pos === "participant" ? "panel" : pos, page: page, variant: vname };
        var zgood = zs.length === 1 && Object.keys(zp).sort().join(",") === "page,position,store,variant" && (gw.__z || []).length === 1;
        Object.keys(zwant).forEach(function (k) { if (zp[k] !== zwant[k]) { zgood = false; } });
        ok(label + " " + pos + "/" + st + " one GA4 app_store_click, four params correct", zgood, JSON.stringify(gw.__z));
        ok(label + " " + pos + "/" + st + " GA4 event has no 'participant'", JSON.stringify(gw.__z).toLowerCase().indexOf("participant") === -1, JSON.stringify(gw.__z));
        if (pos === "hero" && st === "ios") {
          clickEv(gw, a);
          ok(label + " fast double tap sends one event", events(gw, "DownloadApp").length === 1, events(gw, "DownloadApp").length);
          ok(label + " fast double tap sends one GA4 event", zEvents(gw, "app_store_click").length === 1, zEvents(gw, "app_store_click").length);
        }
        drop(g);
      }
    }
    // pixel blocked: fbq missing -> link works normally (not prevented)
    var b = await load(url, 1280, 900);
    var bd = b.contentDocument, bw = b.contentWindow;
    setHrefsInert(bd);
    bw.fbq = undefined;
    stubZaraz(bw);
    var ba = bd.querySelector("#hero a[data-store='ios']");
    var bev = clickEv(bw, ba);
    ok(label + " with pixel blocked the store link is not intercepted", bev.defaultPrevented === false);
    ok(label + " with pixel blocked GA4 app_store_click is still sent once", zEvents(bw, "app_store_click").length === 1, JSON.stringify(bw.__z));
    drop(b);
    // neither Meta nor Zaraz present (both blocked): link still works, no error
    var nb = await load(url, 1280, 900);
    var nbd = nb.contentDocument, nbw = nb.contentWindow;
    setHrefsInert(nbd);
    nbw.fbq = undefined; nbw.zaraz = undefined;
    var nbev = clickEv(nbw, nbd.querySelector("#hero a[data-store='android']"));
    ok(label + " with Meta and Zaraz both blocked the store link still works", nbev.defaultPrevented === false);
    drop(nb);
    b = null;
    if (b) { drop(b); }

    // OpenWebApp (needs no-touch 1024+, which this frame is)
    var o = await load(url, 1280, 900);
    var od = o.contentDocument, ow = o.contentWindow;
    // SHOW_WEB_APP_LINE is false in tracking.js (web app sign-up to find support is "Coming Soon"): the line stays hidden even on laptops.
    var lines = Array.prototype.slice.call(od.querySelectorAll(".webapp-line"));
    ok(label + " laptop line hidden at 1280 while web app sign-up is not live", lines.length >= 2 && lines.every(function (l) { return !shown(l); }), lines.length + " lines");
    setHrefsInert(od);
    stubZaraz(ow);
    var wa = od.querySelector("#hero a[data-webapp]");
    clickEv(ow, wa);
    var we = events(ow, "OpenWebApp");
    ok(label + " OpenWebApp sent once with page and variant only", we.length === 1 && Object.keys(we[0].params).sort().join(",") === "page,variant" && we[0].params.page === page && we[0].params.variant === vname, JSON.stringify(we[0] && we[0].params));
    ok(label + " OpenWebApp did not send DownloadApp", events(ow, "DownloadApp").length === 0);
    ok(label + " OpenWebApp sends nothing to GA4 (not in this brief)", (ow.__z || []).length === 0, JSON.stringify(ow.__z));
    drop(o);
  }

  async function laptopLineHidden(base, label) {
    var f = await load(base, 375, 667);
    var d = f.contentDocument;
    var any = Array.prototype.some.call(d.querySelectorAll(".webapp-line"), shown);
    ok(label + " laptop line hidden at 375px", !any);
    drop(f);
    var g = await load(base, 800, 900);
    var any2 = Array.prototype.some.call(g.contentDocument.querySelectorAll(".webapp-line"), shown);
    ok(label + " laptop line hidden at 800px", !any2);
    drop(g);
  }

  async function stickyChecks(base, label) {
    var f = await load(base, 375, 667);
    var d = f.contentDocument, w = f.contentWindow;
    var bar = d.getElementById("sticky");
    await frames(); await sleep(200);
    ok(label + " sticky hidden at top of page", !shown(bar));
    var hero = d.getElementById("hero");
    var past = hero.getBoundingClientRect().bottom + w.scrollY + 40;
    jump(w, past);
    await frames(); await sleep(300);
    ok(label + " sticky visible once hero has scrolled away", shown(bar));
    var barH = bar.getBoundingClientRect().height;
    var pad = parseFloat(getComputedStyle(d.body).paddingBottom);
    ok(label + " body bottom padding covers bar", pad >= barH, "padding " + pad + " bar " + Math.round(barH));
    ok(label + " sticky holds both badges for unknown OS", Array.prototype.filter.call(bar.querySelectorAll(".store-badge"), shown).length === 2);
    ok(label + " sticky bar has the free line", norm(bar.querySelector(".sticky__note").textContent) === "Free for support coordinators, participants and carers.");
    var overlap = 0, steps = 0, hidSeen = false;
    var finalEl = d.getElementById("final-cta");
    var maxY = d.documentElement.scrollHeight - w.innerHeight;
    for (var y = past; y <= maxY + 200; y += 60) {
      jump(w, y);
      await frames(); await sleep(60);
      steps++;
      if (shown(bar)) {
        var br = bar.getBoundingClientRect();
        Array.prototype.forEach.call(finalEl.querySelectorAll("a[data-store],button,a[data-webapp]"), function (el) {
          if (!shown(el)) { return; }
          var r = el.getBoundingClientRect();
          if (r.bottom > br.top && r.top < br.bottom && r.bottom > 0 && r.top < w.innerHeight) { overlap++; }
        });
      } else if (y > past + 120) { hidSeen = true; }
    }
    ok(label + " sticky never overlaps final CTA controls (" + steps + " scroll steps)", overlap === 0, overlap);
    jump(w, maxY + 500);
    await frames(); await sleep(300);
    ok(label + " sticky hidden at page bottom (final CTA in view)", !shown(bar));
    var tr = d.getElementById("final-cta").getBoundingClientRect();
    ok(label + " final CTA badges visible and not covered at bottom", tr.top < w.innerHeight);
    jump(w, 0);
    await frames(); await sleep(300);
    ok(label + " sticky hides again back at top", !shown(bar));
    drop(f);
    var g = await load(base, 1280, 800);
    var gw = g.contentWindow;
    jump(gw, 1500); await frames(); await sleep(200);
    ok(label + " sticky never shown at 1280", !shown(g.contentDocument.getElementById("sticky")));
    drop(g);
    var t = await load(base, 800, 900);
    jump(t.contentWindow, 1500); await frames(); await sleep(200);
    ok(label + " sticky not shown at 800 (tablet)", !shown(t.contentDocument.getElementById("sticky")));
    drop(t);
  }

  async function panelChecks(base, label) {
    var f = await load(base, 375, 667);
    var d = f.contentDocument;
    var btn = d.getElementById("participant-btn"), panel = d.getElementById("participant-panel");
    ok(label + " participant panel closed at load", !shown(panel) && btn.getAttribute("aria-expanded") === "false");
    btn.click();
    ok(label + " participant panel opens inline", shown(panel) && btn.getAttribute("aria-expanded") === "true");
    ok(label + " panel text and badges", norm(panel.textContent).indexOf("AbleFinder works the same way for you. Post what you need, keep your details private, and choose who to talk to.") > -1 && panel.querySelectorAll("a[data-store][data-audience='participant_carer']").length === 2);
    btn.click();
    ok(label + " participant panel closes again", !shown(panel));
    var link = d.querySelector("#hero a[data-open-participant]");
    link.setAttribute("href", "#final-cta");
    link.click();
    ok(label + " hero participant link opens the panel", shown(panel));
    ok(label + " participant button text", norm(btn.textContent) === "Participant or carer? Find support");
    drop(f);
  }

  async function sectionOrder(label) {
    var keys = Object.keys(LAND_FIRST);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var f = await load(LAND + (k ? "?c=" + k : ""), 375, 667);
      var d = f.contentDocument;
      var secs = Array.prototype.slice.call(d.querySelectorAll("main > section"));
      secs.sort(function (a, b) { return a.getBoundingClientRect().top - b.getBoundingClientRect().top; });
      var ids = secs.map(function (s) { return s.id; });
      ok(label + " ?c=" + (k || "(none)") + " first section under hero is " + LAND_FIRST[k], ids[0] === "hero" && ids[1] === LAND_FIRST[k], ids.join(" > "));
      if (k === "capacity" || k === "private" || k === "built") {
        ok(label + " ?c=" + k + " screen recording drops to position 4 (hero is position 2)", ids[2] === "recording", ids.join(" > "));
      }
      if (k === "") {
        var want = ["hero", "recording", "week", "privacy", "proof", "able2help", "find", "price", "built", "final-cta"];
        ok(label + " default section order matches brief", ids.join() === want.join(), ids.join(" > "));
      }
      drop(f);
    }
  }

  async function contentChecks() {
    var f = await load(LAND, 375, 667);
    var t = norm(f.contentDocument.body.textContent).toLowerCase();
    ["your details stay private until you're ready", "our fastest reply so far", "our able2help team steps in", "400+ support requests posted", "plus 60 more. 65 service categories are live in the app.", "250+ able meet events. 15,000+ connections.", "nobody can pay more to be seen first.", "$150 a month, no tiers"].forEach(function (s) {
      ok("landing copy present: " + s, t.indexOf(s) > -1);
    });
    var ph = norm(f.contentDocument.body.textContent).match(/\[you to (provide|confirm)[^\]]*\]/g) || [];
    ok("landing placeholders visible (none left on landing)", ph.length >= 0, ph.length + " found");
    ok("landing has 5 find tiles and tile names", f.contentDocument.querySelectorAll(".tiles li").length === 5);
    ok("landing: Sam testimonial shown only when consent true", CONSENT ? shown(f.contentDocument.getElementById("sam-testimonial")) : !shown(f.contentDocument.getElementById("sam-testimonial")));
    var imgs = Array.prototype.every.call(f.contentDocument.images, function (i) { return i.hasAttribute("alt"); });
    ok("landing all imgs have alt", imgs);
    var logo = f.contentDocument.querySelector("#logo img");
    ok("landing logo loaded uncropped (natural size > 0, aspect kept)", logo.naturalWidth > 0 && Math.abs(logo.getBoundingClientRect().width / logo.getBoundingClientRect().height - logo.naturalWidth / logo.naturalHeight) < 0.05, logo.naturalWidth + "x" + logo.naturalHeight + " shown " + Math.round(logo.getBoundingClientRect().width) + "x" + Math.round(logo.getBoundingClientRect().height));
    var vids = f.contentDocument.querySelectorAll("video");
    ok("landing video has controls, playsinline, preload none, no autoplay, default captions", vids.length === 1 && vids[0].controls && vids[0].hasAttribute("playsinline") && vids[0].preload === "none" && !vids[0].autoplay && !!vids[0].querySelector("track[kind=captions][default]"));
    drop(f);
    var g = await load(START, 375, 667);
    var t2 = norm(g.contentDocument.body.textContent).toLowerCase();
    ["anonymous by default. your details stay private until you're ready.", "from the team behind able plus - 250+ able meet events and 15,000+ connections.", "our able2help team steps in", "three steps", "ana, co-founder, on a real coordinator's request."].forEach(function (s) {
      ok("start copy present: " + s, t2.indexOf(s) > -1);
    });
    var vids2 = g.contentDocument.querySelectorAll("video");
    ok("start video attributes (captions track present, off by default - burned in)", vids2.length === 1 && vids2[0].controls && vids2[0].hasAttribute("playsinline") && vids2[0].preload === "none" && !vids2[0].autoplay && !!vids2[0].querySelector("track[kind=captions]") && !vids2[0].querySelector("track[default]"));
    ok("start all imgs have alt", Array.prototype.every.call(g.contentDocument.images, function (i) { return i.hasAttribute("alt"); }));
    var h2s = g.contentDocument.querySelectorAll("h1").length;
    ok("start has 7 H1 elements in markup (variants), one visible", h2s === 7);
    drop(g);
    // heading order: no h3 before an h2 etc
    for (var pi = 0; pi < 2; pi++) {
      var pg = await load(pi ? START : LAND, 375, 667);
      var hs = Array.prototype.map.call(pg.contentDocument.querySelectorAll("h1,h2,h3"), function (h) { return +h.tagName[1]; });
      var okOrder = true, prev = 0;
      hs.forEach(function (n) { if (n > prev + 1) { okOrder = false; } prev = n; });
      ok((pi ? "start" : "landing") + " heading order never skips a level", okOrder, hs.join(""));
      drop(pg);
    }
  }

  async function tapTargets() {
    var pages = [LAND, START];
    for (var i = 0; i < pages.length; i++) {
      var f = await load(pages[i], 375, 667);
      var d = f.contentDocument;
      var small = [];
      Array.prototype.forEach.call(d.querySelectorAll("a[href],button"), function (el) {
        if (!shown(el) || el.closest(".skip")) { return; }
        if (el.closest("#sticky") && !shown(d.getElementById("sticky"))) { return; }
        var r = el.getBoundingClientRect();
        if (r.height < 44 || r.width < 44) { small.push((el.textContent || el.id || el.className).trim().slice(0, 30) + " " + Math.round(r.width) + "x" + Math.round(r.height)); }
      });
      ok((i ? "start" : "landing") + " tap targets >= 44px (visible links/buttons)", small.length === 0, small.join("; "));
      drop(f);
    }
  }

  async function osMode() {
    var want = P.get("os");
    var out = {};
    [LAND, START].forEach(function () {});
    for (var i = 0; i < 2; i++) {
      var f = await load(i ? START : LAND, 375, 667);
      var d = f.contentDocument, w = f.contentWindow;
      var bs = Array.prototype.filter.call(d.querySelectorAll("#hero .store-badge"), shown).sort(function (a, b) { return a.getBoundingClientRect().left - b.getBoundingClientRect().left; });
      ok("os=" + want + " " + (i ? "start" : "landing") + " first hero badge is " + (want === "android" ? "android" : "ios"), bs[0] && bs[0].dataset.store === (want === "android" ? "android" : "ios"), bs.map(function (b) { return b.dataset.store; }).join(","));
      jump(w, d.getElementById("hero").getBoundingClientRect().bottom + w.scrollY + 40);
      await frames(); await sleep(300);
      var sb = Array.prototype.filter.call(d.querySelectorAll("#sticky .store-badge"), shown);
      ok("os=" + want + " " + (i ? "start" : "landing") + " sticky shows only the " + want + " badge", sb.length === 1 && sb[0].dataset.store === want, sb.map(function (b) { return b.dataset.store; }).join(","));
      drop(f);
    }
  }


  // ---------------- lead form gate ----------------
  function setUnlocked(on) { try { if (on) { localStorage.setItem("af_unlocked", "1"); } else { localStorage.removeItem("af_unlocked"); } } catch (e) {} }
  async function mock(mode) { await fetch("/__mock?mode=" + mode); }
  async function leads() { return (await fetch("/__leads")).json(); }
  function stubTs(w, token) { w.__tsReset = 0; w.turnstile = { getResponse: function () { return token; }, reset: function () { w.__tsReset++; } }; }
  function storeShown(d) { return Array.prototype.filter.call(d.querySelectorAll("a[data-store]"), shown); }
  function fill(d, v) {
    var f = d.getElementById("lead-form");
    f.elements.name.value = v.name || ""; f.elements.email.value = v.email || ""; f.elements.phone.value = v.phone || "";
    f.elements.role.value = v.role || ""; if (v.company) { f.elements.company.value = v.company; }
  }
  async function submitAndWait(d, w, ms) {
    d.getElementById("lf-submit").click();
    var t0 = Date.now();
    while (Date.now() - t0 < (ms || 9000)) {
      await sleep(100);
      var btn = d.getElementById("lf-submit");
      if (d.documentElement.classList.contains("unlocked") || (!btn.disabled && btn.textContent === "Get the app" && Date.now() - t0 > 150)) { break; }
    }
    await sleep(100);
  }
  var PII = ["Mary Ann", "Lee", "test@example.com", "0412", "participant"];
  function leaks(w) {
    var s = JSON.stringify(w.fbq.queue || []) + JSON.stringify(w.__z || []);
    s = s.replace(/"participant_carer"|"participant"/g, function (m) { return m; });
    return PII.filter(function (x) { return s.indexOf(x) > -1; });
  }

  async function gateLockedChecks() {
    setUnlocked(false);
    var sets = [[LAND, LAND_H1, "landing"], [START, START_H1, "start"]];
    for (var s = 0; s < sets.length; s++) {
      var keys = Object.keys(sets[s][1]);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i], url = sets[s][0] + (k ? "?c=" + k : ""), lab = sets[s][2] + " ?c=" + (k || "(none)");
        var f = await load(url, 375, 667), d = f.contentDocument;
        ok(lab + " locked: no store link visible", storeShown(d).length === 0, storeShown(d).length);
        ok(lab + " locked: form visible", shown(d.getElementById("lead-form")));
        var btn = d.getElementById("lf-submit").getBoundingClientRect();
        if (sets[s][2] === "start") {
          var h1 = visibleH1s(d)[0].getBoundingClientRect(), lede = d.querySelector("#hero .lede").getBoundingClientRect();
          ok(lab + " 375x667: H1, free line and whole form incl. button above the fold", h1.top >= 0 && lede.bottom <= 667 && btn.bottom <= 667, "button bottom " + Math.round(btn.bottom) + "px");
          ok(lab + " consent line position (info)", true, "consent bottom " + Math.round(d.querySelector(".lead__consent").getBoundingClientRect().bottom) + "px");
        } else {
          ok(lab + " form button position (info)", true, "button bottom " + Math.round(btn.bottom) + "px");
        }
        drop(f);
        var g = await load(url, 360, 640), gd = g.contentDocument;
        ok(lab + " locked: no horizontal scroll at 360", gd.documentElement.scrollWidth <= 360, gd.documentElement.scrollWidth);
        drop(g);
      }
    }
    // tabbing order, labels, tap targets, consent styling
    var pages = [[LAND, "landing"], [START, "start"]];
    for (var p = 0; p < pages.length; p++) {
      var f2 = await load(pages[p][0], 375, 667), d2 = f2.contentDocument, w2 = f2.contentWindow;
      var tab = Array.prototype.filter.call(d2.querySelectorAll("#lead-form input,#lead-form select,#lead-form button"), function (el) { return el.type !== "hidden" && el.tabIndex >= 0 && shown(el); }).map(function (el) { return el.id; });
      ok(pages[p][1] + " keyboard order: name, email, phone, role, button (honeypot skipped)", tab.join(",") === "lf-name,lf-email,lf-phone,lf-role,lf-submit", tab.join(","));
      var small = [];
      Array.prototype.forEach.call(d2.querySelectorAll("a[href],button,input,select"), function (el) {
        if (!shown(el) || el.closest(".skip") || el.closest(".hp") || el.type === "hidden") { return; }
        if (el.closest("#sticky") && !shown(d2.getElementById("sticky"))) { return; }
        var r = el.getBoundingClientRect();
        if (r.height < 44 || r.width < 44) { small.push((el.textContent || el.id).trim().slice(0, 24) + " " + Math.round(r.width) + "x" + Math.round(r.height)); }
      });
      ok(pages[p][1] + " locked: tap targets >= 44px (incl. fields)", small.length === 0, small.join("; "));
      var c = d2.querySelector(".lead__consent"), cs = w2.getComputedStyle(c);
      ok(pages[p][1] + " consent line >= 14px and in ink colour", parseFloat(cs.fontSize) >= 14 && cs.color === "rgb(5, 63, 92)", cs.fontSize + " " + cs.color);
      var pl = c.querySelector("a");
      ok(pages[p][1] + " consent Privacy policy link opens in a new tab", pl && pl.target === "_blank" && pl.href === "https://www.ablefinder.net.au/privacy-policy");
      ok(pages[p][1] + " role select starts on 'Choose one' (nothing chosen)", d2.getElementById("lf-role").value === "");
      ok(pages[p][1] + " hidden variant field filled", d2.querySelector("#lead-form input[name=variant]").value === "default");
      drop(f2);
    }
  }

  async function gotoChecks(base, label) {
    setUnlocked(false);
    // sticky -> form
    var f = await load(base, 375, 667), d = f.contentDocument, w = f.contentWindow;
    jump(w, d.getElementById("hero").getBoundingClientRect().bottom + w.scrollY + 40); await frames(); await sleep(300);
    var sb = d.querySelector("#sticky .gate-btn");
    ok(label + " sticky shows 'Get the app' before submit", shown(sb) && norm(sb.textContent) === "Get the app" && Array.prototype.filter.call(d.querySelectorAll("#sticky a[data-store]"), shown).length === 0);
    sb.click(); await sleep(900);
    ok(label + " sticky button takes you to the form and focuses Name", d.activeElement && d.activeElement.id === "lf-name" && d.getElementById("lead").getBoundingClientRect().top < w.innerHeight);
    drop(f);
    // final CTA -> form
    f = await load(base, 375, 667); d = f.contentDocument; w = f.contentWindow;
    var fb = d.querySelector("#final-cta > .wrap > .card > .gate-btn, #final-cta .final > .gate-btn");
    ok(label + " final CTA shows 'Get the app' before submit", shown(fb) && Array.prototype.filter.call(d.querySelectorAll("#final-cta a[data-store]"), shown).length === 0);
    fb.click(); await sleep(900);
    ok(label + " final CTA button goes to the form, Name focused", d.activeElement && d.activeElement.id === "lf-name");
    // participant panel -> form with preset
    d.getElementById("participant-btn").click(); await sleep(900);
    ok(label + " participant button opens the panel, presets 'Participant or carer', goes to the form",
      shown(d.getElementById("participant-panel")) && d.getElementById("lf-role").value === "participant_carer" && d.activeElement && d.activeElement.id === "lf-name");
    drop(f);
    f = await load(base, 375, 667); d = f.contentDocument;
    clickEv(f.contentWindow, d.querySelector("#hero a[data-open-participant]")); await sleep(600);
    ok(label + " hero 'Participant or carer?' link presets the role and focuses Name", d.getElementById("lf-role").value === "participant_carer" && d.activeElement && d.activeElement.id === "lf-name");
    drop(f);
    // header (desktop)
    f = await load(base, 1280, 900); d = f.contentDocument;
    var hb = d.querySelector(".site-header .gate-btn");
    ok(label + " header shows 'Get the app' (not store badges) before submit at 1280", shown(hb) && Array.prototype.filter.call(d.querySelectorAll(".site-header a[data-store]"), shown).length === 0);
    hb.click(); await sleep(900);
    ok(label + " header button goes to the form", d.activeElement && d.activeElement.id === "lf-name");
    drop(f);
  }

  async function validationChecks(base, label) {
    setUnlocked(false); await mock("ok");
    var f = await load(base, 375, 667), d = f.contentDocument, w = f.contentWindow;
    stubTs(w, "tok"); stubZaraz(w);
    await submitAndWait(d, w, 1500);
    var errs = ["lf-name", "lf-email", "lf-phone", "lf-role"].map(function (id) { var e = d.getElementById(id + "-err"); return shown(e) ? norm(e.textContent) : ""; });
    ok(label + " empty submit: name, email and role errors, no phone error", errs.join("|") === "Please add your name.|Please check your email address.||Please choose one.", errs.join("|"));
    ok(label + " focus moves to the first problem (Name)", d.activeElement && d.activeElement.id === "lf-name");
    var ni = d.getElementById("lf-name");
    ok(label + " error tied to the field (aria-invalid, aria-describedby)", ni.getAttribute("aria-invalid") === "true" && ni.getAttribute("aria-describedby") === "lf-name-err");
    ok(label + " no request sent for invalid input", (await leads()).length === 0);
    fill(d, { name: "Mary Ann Lee", email: "not-an-email", phone: "", role: "support_coordinator" });
    await submitAndWait(d, w, 1500);
    ok(label + " bad email: email error and focus", shown(d.getElementById("lf-email-err")) && d.activeElement.id === "lf-email");
    fill(d, { name: "Mary Ann Lee", email: "test@example.com", phone: "12345", role: "support_coordinator" });
    await submitAndWait(d, w, 1500);
    ok(label + " phone 12345: phone error, nothing sent", norm(d.getElementById("lf-phone-err").textContent) === "Please check your phone number, or leave it blank." && (await leads()).length === 0);
    ok(label + " still locked after errors, no events", !d.documentElement.classList.contains("unlocked") && events(w, "SubmitLeadForm").length === 0 && zEvents(w, "generate_lead").length === 0);
    drop(f);
  }

  async function successChecks(base, page, label) {
    setUnlocked(false); await mock("ok");
    var f = await load(base + "?c=" + (page === "sc-start" ? "sameday" : "private") + "&utm_source=meta&utm_medium=paid_social&utm_campaign=sc-wsyd&utm_content=S2%20test", 375, 667);
    var d = f.contentDocument, w = f.contentWindow, variant = page === "sc-start" ? "sameday" : "private";
    stubTs(w, "tok"); stubZaraz(w);
    fill(d, { name: "Mary Ann Lee", email: "test@example.com", phone: "0412 345 678", role: "support_coordinator" });
    d.getElementById("lf-submit").click();
    ok(label + " button shows 'Sending...' and is disabled", d.getElementById("lf-submit").textContent === "Sending..." && d.getElementById("lf-submit").disabled);
    d.getElementById("lf-submit").click();   // a second tap must not send twice
    await submitAndWait(d, w, 1);
    for (var i = 0; i < 40 && !d.documentElement.classList.contains("unlocked"); i++) { await sleep(100); }
    var L = await leads();
    ok(label + " exactly one request for two taps", L.length === 1, L.length);
    var body = L.length ? JSON.parse(L[0].body) : {};
    ok(label + " request has exactly the briefed fields", Object.keys(body).sort().join(",") === "company,email,name,page,phone,role,turnstileToken,utm_campaign,utm_content,utm_medium,utm_source,variant", Object.keys(body).sort().join(","));
    ok(label + " request values", body.name === "Mary Ann Lee" && body.email === "test@example.com" && body.phone === "0412 345 678" && body.role === "support_coordinator" && body.page === page && body.variant === variant && body.turnstileToken === "tok" && body.utm_content === "S2 test" && body.utm_source === "meta", JSON.stringify(body));
    ok(label + " unlocked: 'You're in, Mary Ann.' line", norm(d.getElementById("lead-done").textContent) === "You're in, Mary Ann. Download AbleFinder and post your first request.");
    ok(label + " unlocked: form gone, hero store buttons shown", !shown(d.getElementById("lead")) && Array.prototype.filter.call(d.querySelectorAll("#hero a[data-store]"), shown).length === 2);
    ok(label + " unlocked: final CTA shows store buttons, no 'Get the app'", Array.prototype.filter.call(d.querySelectorAll("#final-cta .final > .store-badges a[data-store]"), shown).length === 2 && !shown(d.querySelector("#final-cta .final > .gate-btn")));
    jump(w, d.getElementById("hero").getBoundingClientRect().bottom + w.scrollY + 40); await frames(); await sleep(300);
    ok(label + " unlocked: sticky shows store buttons", Array.prototype.filter.call(d.querySelectorAll("#sticky a[data-store]"), shown).length >= 1 && !shown(d.querySelector("#sticky .gate-btn")));
    var ev = events(w, "SubmitLeadForm");
    ok(label + " one SubmitLeadForm with page and variant only", ev.length === 1 && Object.keys(ev[0].params).sort().join(",") === "page,variant" && ev[0].params.page === page && ev[0].params.variant === variant && !!ev[0].opts.eventID, JSON.stringify(ev));
    var std = Array.prototype.filter.call(w.fbq.queue || [], function (a) { return a[1] === "Lead"; }).length;
    ok(label + " no standard Lead event (restricted on this dataset)", std === 0);
    var ze = zEvents(w, "generate_lead");
    ok(label + " one GA4 generate_lead with page and variant only", ze.length === 1 && Object.keys(ze[0][1]).sort().join(",") === "page,variant" && ze[0][1].variant === variant);
    ok(label + " nothing typed reaches Meta or GA4 (name, email, phone, 'participant')", leaks(w).length === 0, leaks(w).join(","));
    var ls = null; try { ls = w.localStorage.getItem("af_unlocked"); } catch (e) {}
    ok(label + " af_unlocked saved (no personal details stored)", ls === "1" && JSON.stringify(Object.keys(w.localStorage)).indexOf("name") === -1);
    // store tap after unlock still sends DownloadApp with five params
    setHrefsInert(d);
    clickEv(w, d.querySelector("#hero a[data-store='ios']"));
    var dl = events(w, "DownloadApp");
    ok(label + " DownloadApp still fires after unlock with its five params", dl.length === 1 && Object.keys(dl[0].params).sort().join(",") === "audience,page,position,store,variant", JSON.stringify(dl));
    drop(f);
    // reload: no form, store buttons straight away; the other page too
    var g = await load(base, 375, 667);
    ok(label + " reload after submit: no form, store buttons straight away", !shown(g.contentDocument.getElementById("lead")) && Array.prototype.filter.call(g.contentDocument.querySelectorAll("#hero a[data-store]"), shown).length === 2);
    drop(g);
    var other = await load(base === LAND ? START : LAND, 375, 667);
    ok(label + " the other page is unlocked too", !shown(other.contentDocument.getElementById("lead")) && storeShown(other.contentDocument).length >= 2);
    drop(other);
    setUnlocked(false);
  }

  async function outcomeChecks(base, label) {
    var cases = [
      { mode: "fallback", ts: "tok", unlock: true, events: true, note: "Bigin down (KV backup): unlocks and counts the lead" },
      { mode: "e500", ts: "tok", unlock: true, events: false, note: "server error: unlocks, no events" },
      { mode: "e502html", ts: "tok", unlock: true, events: false, note: "bad gateway (not JSON): unlocks, no events" },
      { mode: "phone400", ts: "tok", unlock: false, events: false, note: "server rejects phone: phone error shown" },
      { mode: "turnstile400", ts: "tok", unlock: false, events: false, note: "bot check failed: retry message, check reset" },
      { mode: "ok_first_empty", ts: "tok", unlock: true, events: true, note: "single name 'Priya': 'You're in, Priya.'", name: "Priya" },
      { mode: "ok", ts: "tok", unlock: true, events: false, note: "honeypot filled: no events", company: "Acme" },
      { mode: "ok", ts: "tok", unlock: true, events: true, note: "provider: provider line shown", role: "provider" },
      { mode: "auto", ts: null, unlock: true, events: false, note: "bot check never loaded: unlocks without saving, no events", slow: true }
    ];
    for (var i = 0; i < cases.length; i++) {
      var c = cases[i];
      setUnlocked(false); await mock(c.mode);
      var f = await load(base, 375, 667), d = f.contentDocument, w = f.contentWindow;
      stubZaraz(w); if (c.ts) { stubTs(w, c.ts); }
      fill(d, { name: c.name || "Mary Ann Lee", email: "test@example.com", phone: "", role: c.role || "support_coordinator", company: c.company });
      await submitAndWait(d, w, c.slow ? 12000 : 6000);
      var un = d.documentElement.classList.contains("unlocked");
      var nev = events(w, "SubmitLeadForm").length + zEvents(w, "generate_lead").length;
      var extra = true, detail = "";
      if (c.mode === "phone400") { extra = shown(d.getElementById("lf-phone-err")) && d.activeElement.id === "lf-phone"; }
      if (c.mode === "turnstile400") { extra = norm(d.getElementById("lf-form-err").textContent) === "Something went wrong checking you're not a bot. Please try again." && w.__tsReset === 1 && d.getElementById("lf-submit").textContent === "Get the app"; }
      if (c.name === "Priya") { detail = norm(d.getElementById("lead-done").textContent); extra = detail === "You're in, Priya. Download AbleFinder and post your first request."; }
      if (c.role === "provider") { extra = shown(d.getElementById("provider-next")) && norm(d.getElementById("provider-next").textContent).indexOf("Setting up as a provider? See how it works") === 0; }
      if (c.mode === "ok" && !c.role && !c.company) { extra = !shown(d.getElementById("provider-next")); }
      ok(label + " " + c.note, un === c.unlock && (c.events ? nev === 2 : nev === 0) && extra, "unlocked=" + un + " events=" + nev + " " + detail);
      if (!c.role && c.mode === "fallback") { ok(label + " non-provider: no provider line", !shown(d.getElementById("provider-next"))); }
      drop(f);
    }
    setUnlocked(false);
  }

  // ---------------- the Cloudflare function, with Bigin / Turnstile / KV simulated ----------------
  async function fnChecks() {
    var pageHtml = await (await fetch(START)).text();
    var consentPage = (pageHtml.match(/<p class="lead__consent">([^<]+) <a /) || [])[1];
    var realFetch = window.fetch, realErr = console.error, n = 0;
    async function run(opts) {
      n++;
      var mod = await import("/functions/api/lead.js?v=" + n);   // fresh module: no cached Bigin token between cases
      var calls = [], logs = [], kv = [];
      var cfg = Object.assign({ ts: true, token: 200, upsert: 200, search: "found", write: 200 }, opts.cfg || {});
      window.fetch = async function (url, init) {
        url = String(url); init = init || {};
        var body = init.body;
        if (body && typeof body !== "string") { body = body instanceof URLSearchParams ? body.toString() : (body instanceof FormData ? Array.from(body.entries()).map(function (e) { return e.join("="); }).join("&") : String(body)); }
        calls.push({ url: url, method: init.method || "GET", headers: init.headers || {}, body: body });
        function J(status, obj) { return new Response(status === 204 ? null : JSON.stringify(obj), { status: status, headers: { "Content-Type": "application/json" } }); }
        if (url.indexOf("siteverify") > -1) { return J(200, { success: cfg.ts }); }
        if (url.indexOf("/oauth/v2/token") > -1) { return cfg.token === 200 ? J(200, { access_token: "AT", expires_in: 3600 }) : J(cfg.token, { error: "invalid_code" }); }
        if (url.indexOf("/Contacts/upsert") > -1) { return cfg.upsert === 200 ? J(200, { data: [{ code: "SUCCESS", status: "success", details: { id: "1" } }] }) : J(cfg.upsert, { code: "INVALID_URL_PATTERN" }); }
        if (url.indexOf("/Contacts/search") > -1) { return cfg.search === "found" ? J(200, { data: [{ id: "99" }] }) : J(204, null); }
        if (/\/Contacts$/.test(url)) { return J(cfg.write === 200 ? (init.method === "POST" ? 201 : 200) : cfg.write, { data: [{ code: cfg.write === 200 ? "SUCCESS" : "INVALID_DATA", status: cfg.write === 200 ? "success" : "error" }] }); }
        throw new Error("unexpected fetch " + url);
      };
      console.error = function () { logs.push(Array.prototype.map.call(arguments, String).join(" ")); };
      var env = Object.assign({ TURNSTILE_SECRET: "ts-secret-value", BIGIN_CLIENT_ID: "cid-value", BIGIN_CLIENT_SECRET: "csecret-value", BIGIN_REFRESH_TOKEN: "rtok-value",
        BIGIN_ACCOUNTS_URL: "https://accounts.zoho.com.au", BIGIN_API_BASE: "https://www.zohoapis.com.au/bigin/v2",
        LEADS_FALLBACK: { put: async function (k, v, o) { kv.push({ k: k, v: v, o: o }); } } }, opts.env || {});
      Object.keys(opts.unset || {}).forEach(function (k) { delete env[k]; });
      var req = opts.request || new Request("https://go.ablefinder.net.au/api/lead", { method: opts.method || "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": "1.2.3.4" }, body: opts.method === "GET" ? undefined : (opts.raw !== undefined ? opts.raw : JSON.stringify(Object.assign({ name: "Mary Ann Lee", email: "test@example.com", phone: "", role: "support_coordinator", company: "", turnstileToken: "tok", page: "sc-landing", variant: "private", utm_source: "meta", utm_medium: "paid_social", utm_campaign: "sc-wsyd", utm_content: "S2 test" }, opts.body || {}))) });
      var res;
      try { res = await (opts.method === "GET" ? mod.onRequest({ request: req, env: env }) : mod.onRequestPost({ request: req, env: env })); }
      finally { window.fetch = realFetch; console.error = realErr; }
      var text = await res.text(), j = null; try { j = JSON.parse(text); } catch (e) {}
      var up = calls.filter(function (c) { return /\/Contacts(\/upsert)?$/.test(c.url); }).pop();
      var rec = up ? JSON.parse(up.body).data[0] : null;
      return { status: res.status, j: j, text: text, type: res.headers.get("Content-Type"), calls: calls, logs: logs, kv: kv, rec: rec, up: up, mod: mod };
    }
    var r;
    r = await run({ body: { company: "Acme" } });
    ok("fn: honeypot -> 200 ok, nothing called", r.status === 200 && r.j.ok === true && r.calls.length === 0);
    r = await run({ unset: { TURNSTILE_SECRET: 1 } });
    ok("fn: missing TURNSTILE_SECRET -> 500 (page unlocks)", r.status === 500 && r.calls.length === 0);
    r = await run({ cfg: { ts: false } });
    ok("fn: Turnstile fails -> 400 turnstile, Bigin not called", r.status === 400 && r.j.error === "turnstile" && r.calls.length === 1);
    var vcases = [[{ name: "  " }, "name"], [{ name: new Array(82).join("x") }, "name"], [{ email: "nope" }, "email"], [{ email: new Array(110).join("a") + "@example.com" }, "email"], [{ role: "admin" }, "role"], [{ phone: "12345" }, "phone"], [{ phone: "0512 345 678" }, "phone"]];
    for (var i = 0; i < vcases.length; i++) {
      r = await run({ body: vcases[i][0] });
      ok("fn: invalid " + vcases[i][1] + " " + JSON.stringify(vcases[i][0]).slice(0, 30) + " -> 400 " + vcases[i][1] + ", Bigin not called", r.status === 400 && r.j.error === vcases[i][1] && !r.calls.some(function (c) { return c.url.indexOf("zoho") > -1; }));
    }
    r = await run({ body: { name: " Mary  Ann   Lee ", email: " Test@Example.COM " } });
    var tokCall = r.calls.filter(function (c) { return c.url.indexOf("/oauth/v2/token") > -1; })[0];
    ok("fn: token request = refresh grant to accounts.zoho.com.au", tokCall && tokCall.url === "https://accounts.zoho.com.au/oauth/v2/token" && /grant_type=refresh_token/.test(tokCall.body) && /refresh_token=rtok-value/.test(tokCall.body));
    ok("fn: upsert to Bigin AU, matched on Email, with OAuth header", r.up && r.up.url === "https://www.zohoapis.com.au/bigin/v2/Contacts/upsert" && JSON.parse(r.up.body).duplicate_check_fields.join() === "Email" && r.up.headers.Authorization === "Zoho-oauthtoken AT");
    ok("fn: Mary Ann Lee -> First 'Mary Ann', Last 'Lee'; email lower-cased", r.rec && r.rec.First_Name === "Mary Ann" && r.rec.Last_Name === "Lee" && r.rec.Email === "test@example.com", JSON.stringify(r.rec));
    ok("fn: blank phone -> no Mobile or Phone sent", r.rec && !("Mobile" in r.rec) && !("Phone" in r.rec));
    ok("fn: role, source, page, UTM content, tag", r.rec && r.rec.AF_Source === "Support coordinator" && r.rec.AF_Source1 === "meta-lp" && r.rec.AF_Page === "sc-landing-private" && r.rec.AF_UTM_Content === "S2 test" && JSON.stringify(r.rec.Tag) === '[{"name":"SC WSYD LP"}]');
    ok("fn: consent time is ISO 8601 Sydney time", r.rec && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+1[01]:00$/.test(r.rec.AF_Consent), r.rec && r.rec.AF_Consent);
    ok("fn: consent text matches the page word for word", r.rec && consentPage && r.rec.AF_Consent_Text === consentPage, (r.rec && r.rec.AF_Consent_Text) + " | " + consentPage);
    ok("fn: success -> 200 { ok, first: 'Mary Ann' }", r.status === 200 && r.j.ok === true && r.j.first === "Mary Ann" && !r.j.fallback);
    ok("fn: success logs nothing", r.logs.length === 0, r.logs.join(" / "));
    r = await run({ body: { name: "Priya" } });
    ok("fn: 'Priya' -> First empty, Last 'Priya', no error", r.status === 200 && r.rec.First_Name === "" && r.rec.Last_Name === "Priya");
    r = await run({ body: { phone: "0412 345 678" } });
    ok("fn: 0412 345 678 -> Mobile +61412345678", r.rec.Mobile === "+61412345678" && !("Phone" in r.rec));
    r = await run({ body: { phone: "(02) 9876 5432" } });
    ok("fn: (02) 9876 5432 -> Phone +61298765432", r.rec.Phone === "+61298765432" && !("Mobile" in r.rec));
    r = await run({ body: { phone: "+61 412-345-678" } });
    ok("fn: +61 412-345-678 -> Mobile +61412345678", r.rec.Mobile === "+61412345678");
    r = await run({ body: { phone: "07 3000 1234" } });
    ok("fn: 07 3000 1234 -> Phone +61730001234", r.rec.Phone === "+61730001234");
    r = await run({ env: { BIGIN_FIELD_ROLE: "Role_API", BIGIN_FIELD_PAGE: "Page_API" } });
    ok("fn: custom field API names come from settings", r.rec.Role_API === "Support coordinator" && r.rec.Page_API === "sc-landing-private" && !("AF_Source" in r.rec));
    r = await run({ cfg: { upsert: 404, search: "found" } });
    var put = r.calls.filter(function (c) { return /\/Contacts$/.test(c.url); })[0];
    ok("fn: no upsert on the account -> search by email, update the existing contact (no duplicate)", put && put.method === "PUT" && JSON.parse(put.body).data[0].id === "99" && r.j.ok === true && !r.j.fallback);
    r = await run({ cfg: { upsert: 404, search: "none" } });
    var post = r.calls.filter(function (c) { return /\/Contacts$/.test(c.url); })[0];
    ok("fn: no upsert, not found -> create the contact", post && post.method === "POST" && r.j.ok === true && !r.j.fallback);
    r = await run({ cfg: { token: 400 } });
    var all = r.logs.join(" ");
    ok("fn: Bigin token fails -> KV backup, 200 { ok, fallback }", r.status === 200 && r.j.ok === true && r.j.fallback === true && r.kv.length === 1 && r.kv[0].o.expirationTtl === 7776000 && /^\d{4}-\d\d-\d\dT[\d:.]+Z-[a-z0-9]+$/.test(r.kv[0].k) && JSON.parse(r.kv[0].v).record.Email === "test@example.com", JSON.stringify(r.kv[0] && r.kv[0].o));
    ok("fn: failure log has no name, email, phone or secret", r.logs.length > 0 && ["Mary", "Lee", "test@example.com", "rtok-value", "csecret-value", "ts-secret-value", "cid-value"].every(function (s) { return all.indexOf(s) === -1; }), all);
    r = await run({ cfg: { upsert: 500 } });
    ok("fn: Bigin upsert 500 -> KV backup, page unlocks", r.j.fallback === true && r.kv.length === 1);
    r = await run({ cfg: { upsert: 500 }, unset: { LEADS_FALLBACK: 1 } });
    ok("fn: no KV bound and Bigin down -> still 200 (never blocks)", r.status === 200 && r.j.ok === true);
    r = await run({ body: { page: "<script>", variant: "Bad Variant!" } });
    ok("fn: unknown page/variant cleaned to unknown-default", r.rec.AF_Page === "unknown-default");
    var noJs = new Request("https://go.ablefinder.net.au/api/lead", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "page=sc-start&variant=sameday&name=%3Cb%3EMary%3C%2Fb%3E&email=test%40example.com&role=support_coordinator&company=" });
    r = await run({ request: noJs });
    ok("fn: no-JS post -> thank-you page with store buttons, nothing saved", r.status === 200 && /text\/html/.test(r.type) && r.text.indexOf("You're in. Download AbleFinder and post your first request.") > -1 && r.text.indexOf("ct=sc-start-sameday") > -1 && r.text.indexOf("play.google.com") > -1 && r.calls.length === 0 && r.text.indexOf("<b>Mary") === -1 && r.text.indexOf("noindex") > -1);
    r = await run({ raw: "{not json" });
    ok("fn: bad JSON -> 400", r.status === 400);
    r = await run({ raw: JSON.stringify({ name: new Array(12000).join("x") }) });
    ok("fn: oversized body -> 413", r.status === 413);
    r = await run({ method: "GET" });
    ok("fn: GET -> 405", r.status === 405);
    ok("fn: helpers", r.mod.normalisePhone("0412345678") === "+61412345678" && r.mod.normalisePhone("12345") === null && r.mod.splitName("Mary Ann Lee").first === "Mary Ann");
  }

  async function main() {
    try {
      setUnlocked(true);   // the existing checks describe the page after the form
      if (MODE === "os") {
        await osMode();
      } else {
        var sam = CONSENT;
        await h1Checks(LAND, LAND_H1, "landing", false);
        await h1Checks(START, START_H1, "start", sam);
        if (sam) {
          var f = await load(LAND + "?c=default", 375, 667);
          ok("sam mode: testimonial card visible on landing", shown(f.contentDocument.getElementById("sam-testimonial")));
          var t = norm(f.contentDocument.getElementById("sam-testimonial").textContent);
          ok("sam mode: testimonial text", t.indexOf("My participant started therapy within days.") > -1 && t.indexOf("I found it very easy to use.") > -1 && t.indexOf("- Sam, support coordinator, Illawarra") > -1, t);
          drop(f);
          var g = await load(START + "?c=days", 375, 667);
          var ba = Array.prototype.filter.call(g.contentDocument.querySelectorAll("a[data-store]"), function (a) { return a.getAttribute("href").indexOf("sc-start-days") > -1; }).length;
          ok("sam mode: start ?c=days store links carry sc-start-days", ba === g.contentDocument.querySelectorAll("a[data-store]").length, ba);
          drop(g);
        }
        if (MODE !== "sam") {
          await sectionOrder("landing");
          var w1 = await foldChecks(LAND, LAND_H1, "landing");
          var w2 = await foldChecks(START, START_H1, "start");
          ok("worst hero badge bottom landing (info)", true, Math.round(w1) + "px");
          ok("worst hero badge bottom start (info)", true, Math.round(w2) + "px");
          await widthChecks(LAND, LAND_H1, "landing");
          await widthChecks(START, START_H1, "start");
          await stickyChecks(LAND, "landing");
          await stickyChecks(START, "start");
          await panelChecks(LAND, "landing");
          await panelChecks(START, "start");
          await laptopLineHidden(LAND, "landing");
          await laptopLineHidden(START, "start");
          await trackingChecks(LAND, "sc-landing", "", "landing");
          await trackingChecks(LAND, "sc-landing", "capacity", "landing capacity");
          await trackingChecks(LAND, "sc-landing", "built", "landing built");
          await trackingChecks(START, "sc-start", "", "start");
          await trackingChecks(START, "sc-start", "sameday", "start sameday");
          await trackingChecks(START, "sc-start", "tonight", "start tonight");
          if (CONSENT) { await trackingChecks(START, "sc-start", "days", "start days"); }
          await contentChecks();
          await tapTargets();
          // lead form gate (locked state)
          await gateLockedChecks();
          await gotoChecks(LAND, "landing");
          await gotoChecks(START, "start");
          await validationChecks(LAND, "landing");
          await validationChecks(START, "start");
          await successChecks(LAND, "sc-landing", "landing");
          await successChecks(START, "sc-start", "start");
          await outcomeChecks(START, "start");
          await fnChecks();
          setUnlocked(false);
        }
      }
    } catch (e) {
      ok("harness ran without exception", false, e && e.stack || e);
    }
    var payload = JSON.stringify(R);
    document.getElementById("out").textContent = payload;
    try { fetch("/__result", { method: "POST", body: payload }); } catch (e) {}
  }
  main();
})();
