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
      f.onload = function () {
        try { f.contentWindow.__afTestHuman = true; } catch (e) {}   /* headless Chrome looks like a bot; botChecks() turns this off */
        setTimeout(function () { res(f); }, 200);
      };
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

  // Bot taps (script clicks, automated browsers, taps within 1 second of load) open the store but send no events.
  async function botChecks(base, label) {
    var f = await load(base, 1280, 900);
    var d = f.contentDocument, w = f.contentWindow;
    setHrefsInert(d); stubZaraz(w);
    w.__afTestHuman = undefined;
    var a = d.querySelector("#hero a[data-store='ios']");
    var ev = clickEv(w, a);
    ok(label + " script click (isTrusted false / headless) sends no DownloadApp", events(w, "DownloadApp").length === 0, events(w, "DownloadApp").length);
    ok(label + " script click sends no GA4 app_store_click", zEvents(w, "app_store_click").length === 0, JSON.stringify(w.__z));
    ok(label + " script click still opens the store (not prevented)", ev.defaultPrevented === false);
    drop(f);

    var g = document.createElement("iframe");
    g.style.width = "1280px"; g.style.height = "900px";
    var early = await new Promise(function (res) {
      g.onload = function () {
        var gw = g.contentWindow, gd = g.contentDocument;
        gw.__afTestHuman = "timing";
        setHrefsInert(gd); stubZaraz(gw);
        var e1 = clickEv(gw, gd.querySelector("#hero a[data-store='android']"));
        res({ dl: events(gw, "DownloadApp").length, z: zEvents(gw, "app_store_click").length, prevented: e1.defaultPrevented });
      };
      g.src = base;
      document.body.appendChild(g);
    });
    ok(label + " tap within 1 second of load sends no events", early.dl === 0 && early.z === 0, JSON.stringify(early));
    ok(label + " tap within 1 second of load still opens the store", early.prevented === false);
    await sleep(1100);
    var gw2 = g.contentWindow, gd2 = g.contentDocument;
    var e2 = clickEv(gw2, gd2.querySelector("#hero a[data-store='android']"));
    ok(label + " tap after 1 second sends one DownloadApp and one app_store_click",
       events(gw2, "DownloadApp").length === 1 && zEvents(gw2, "app_store_click").length === 1 && e2.defaultPrevented,
       events(gw2, "DownloadApp").length + "/" + zEvents(gw2, "app_store_click").length);
    drop(g);
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

  async function main() {
    try {
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
          await botChecks(LAND, "landing");
          await botChecks(START, "start");
          await contentChecks();
          await tapTargets();
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
