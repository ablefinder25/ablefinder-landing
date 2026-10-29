/* Store-button tracking for the support coordinator pages.
   DownloadApp means "sent to the store" (a tap on a store button). The page cannot see what happens in the store. */
(function () {
  "use strict";

  const SAM_CONSENT = true;                                 // Sam's consent confirmed by Ana, 10/10/2026
  const PIXEL_PAGE = document.body.dataset.page;            // "sc-landing" | "sc-start"
  const root = document.documentElement;

  // While consent is not given, ?c=days must behave as the default variant.
  if (root.dataset.variant === "days" && !SAM_CONSENT) { root.dataset.variant = "default"; }
  const VARIANT = root.dataset.variant || "default";

  const APP_STORE_BASE = "https://apps.apple.com/au/app/ablefinder/id6751715948";
  const APP_STORE_PT = "128092141";                       // App Store Connect provider token
  const PLAY_PACKAGE = "com.ablefinder.ablefinder";
  const WEB_APP_URL = "https://app.ablefinder.net.au";
  // Off: the web app shows "Sign up to find support (Coming Soon)" (checked 27/10/2026). Turn on when it goes live.
  const SHOW_WEB_APP_LINE = false;

  let lastTap = 0;
  let lastWebTap = 0;

  // GA4 through Cloudflare Zaraz (Zaraz loads GA4; no Google tag on the page)
  function zTrack(name, params){
    try { if (window.zaraz && typeof zaraz.track === "function") zaraz.track(name, params); }
    catch (e) {}
  }

  // Meta's ad review and other crawlers open the pages and tap the store buttons. Their taps still
  // open the store but are not counted. Taps from real people take more than a second after load.
  const PAGE_LOADED_AT = Date.now();
  function isLikelyBot(evt){
    try {
      const test = window.__afTestHuman;                          // local checks only: headless Chrome looks like a bot
      if (test === true) return false;                            // true = treat as a person; "timing" = keep the 1-second rule
      if (test !== "timing") {
        if (evt && evt.isTrusted === false) return true;            // click made by a script, not a finger
        if (navigator.webdriver === true) return true;               // automated browser
        const ua = navigator.userAgent || "";
        if (/bot|crawl|spider|slurp|facebookexternalhit|facebookcatalog|meta-externalagent|headless|lighthouse/i.test(ua)) return true;
      }
      if (Date.now() - PAGE_LOADED_AT < 1000) return true;         // tapped within 1 second of load
      return false;
    } catch (e) { return false; }                                  // if unsure, count it
  }

  function newEventId() {
    return (window.crypto && crypto.randomUUID && crypto.randomUUID()) ||
           (Date.now().toString(36) + Math.random().toString(36).slice(2));
  }

  // ---- store links with campaign tokens ----
  let ct = PIXEL_PAGE + "-" + VARIANT;
  if (ct.length > 40) { ct = PIXEL_PAGE + "-default"; }
  const iosUrl = APP_STORE_BASE + "?" + (APP_STORE_PT ? "pt=" + encodeURIComponent(APP_STORE_PT) + "&" : "") +
                 "ct=" + encodeURIComponent(ct) + "&mt=8";
  const playUrl = "https://play.google.com/store/apps/details?id=" + PLAY_PACKAGE + "&referrer=" +
                  encodeURIComponent("utm_source=meta&utm_medium=paid_social&utm_campaign=sc-wsyd&utm_content=" + ct);
  document.querySelectorAll("a[data-store]").forEach(function (a) {
    a.href = a.dataset.store === "android" ? playUrl : iosUrl;
  });

  // ---- gated Sam testimonial ----
  if (SAM_CONSENT) {
    const sam = document.getElementById("sam-testimonial");
    if (sam) { sam.hidden = false; }
  }

  // ---- click handling ----
  function isModified(e) {
    return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (typeof e.button === "number" && e.button !== 0);
  }

  function send(name, params, eventId) {
    if (typeof window.fbq !== "function") { return false; }   // blocked pixel: let the link work normally
    try { fbq("trackCustom", name, params, { eventID: eventId }); } catch (err) { return false; }
    return true;
  }

  document.addEventListener("click", function (e) {
    const target = e.target && e.target.closest ? e.target : null;
    if (!target) { return; }

    const a = target.closest("a[data-store]");
    if (a) {
      if (isLikelyBot(e)) { return; }                         // no events; the link still opens the store
      const now = Date.now();
      if (now - lastTap < 1500) { return; }                  // ignore double-taps
      lastTap = now;
      const params = {
        store:    a.dataset.store,                           // "ios" | "android"
        position: a.dataset.position,                        // "hero" | "sticky" | "final" | "participant" | "header"
        audience: a.dataset.audience || "coordinator",       // "coordinator" | "participant_carer"
        page:     PIXEL_PAGE,
        variant:  VARIANT
      };
      // Before the Meta blocked check, so a blocked pixel doesn't stop GA4. "participant" never goes to GA4.
      zTrack("app_store_click", {
        store:    params.store,
        position: params.position === "participant" ? "panel" : params.position,
        page:     params.page,
        variant:  params.variant
      });
      if (!send("DownloadApp", params, newEventId())) { return; }
      if (isModified(e)) { return; }
      e.preventDefault();
      const href = a.href;
      setTimeout(function () { window.location.href = href; }, 300);
      return;
    }

    const w = target.closest("a[data-webapp]");
    if (w) {
      const now = Date.now();
      if (now - lastWebTap < 1500) { return; }
      lastWebTap = now;
      if (!send("OpenWebApp", { page: PIXEL_PAGE, variant: VARIANT }, newEventId())) { return; }
      if (isModified(e)) { return; }
      e.preventDefault();
      const href = w.href;
      setTimeout(function () { window.location.href = href; }, 300);
    }
  });

  // ---- laptop line (no touch, 1024px and wider) ----
  const wideQuery = window.matchMedia("(min-width:1024px)");
  const hasTouch = (navigator.maxTouchPoints || 0) > 0 || "ontouchstart" in window;
  function updateWebLine() {
    const show = SHOW_WEB_APP_LINE && !hasTouch && wideQuery.matches;
    document.querySelectorAll(".webapp-line").forEach(function (el) { el.hidden = !show; });
  }
  updateWebLine();
  if (wideQuery.addEventListener) { wideQuery.addEventListener("change", updateWebLine); }
  else if (wideQuery.addListener) { wideQuery.addListener(updateWebLine); }

  // ---- lead form gate ----
  // The store buttons only appear after the form (html.unlocked). One form per page, in the hero.
  const TURNSTILE_SITE_KEY = "0x4AAAAAAFns13xBPzuX6Sh6";   // public Turnstile site key (widget for go.ablefinder.net.au and ablefinder-landing.pages.dev)
  const form = document.getElementById("lead-form");
  const nameInput = document.getElementById("lf-name");
  const roleSelect = document.getElementById("lf-role");
  const submitBtn = document.getElementById("lf-submit");
  const formErr = document.getElementById("lf-form-err");
  const leadBox = document.getElementById("lead");
  let tsWidget = null;
  let tsFailed = false;
  let sending = false;

  function isUnlocked() { return root.classList.contains("unlocked"); }

  function unlock(firstName, role) {
    root.classList.add("unlocked");
    try { localStorage.setItem("af_unlocked", "1"); } catch (err) {}
    const done = document.getElementById("lead-done");
    if (done && firstName) { done.textContent = "You're in, " + firstName + ". Download AbleFinder and post your first request."; }
    const prov = document.getElementById("provider-next");
    if (prov) { prov.hidden = role !== "provider"; }
    if (done) { try { done.focus({ preventScroll: true }); } catch (err) { done.focus(); } }
  }

  // Turnstile renders only if it needs the visitor to do something (managed, interaction-only).
  window.afTurnstileReady = function () {
    if (!window.turnstile || !document.getElementById("lf-turnstile") || isUnlocked()) { return; }
    try {
      tsWidget = turnstile.render("#lf-turnstile", {
        sitekey: TURNSTILE_SITE_KEY, action: "lead", appearance: "interaction-only",
        "error-callback": function () { tsFailed = true; }
      });
    } catch (err) { tsFailed = true; }
  };
  function turnstileToken() {
    try {
      if (window.turnstile && typeof turnstile.getResponse === "function") {
        return (tsWidget !== null ? turnstile.getResponse(tsWidget) : turnstile.getResponse()) || "";
      }
    } catch (err) {}
    return "";
  }
  function resetTurnstile() { try { if (window.turnstile) { if (tsWidget !== null) { turnstile.reset(tsWidget); } else { turnstile.reset(); } } } catch (err) {} }

  const MESSAGES = {
    name: "Please add your name.",
    email: "Please check your email address.",
    phone: "Please check your phone number, or leave it blank.",
    role: "Please choose one.",
    turnstile: "Something went wrong checking you're not a bot. Please try again."
  };
  const FIELDS = { name: "lf-name", email: "lf-email", phone: "lf-phone", role: "lf-role" };

  function cleanPhone(v) { return v.replace(/[\s()\-]/g, ""); }
  function phoneOk(v) { return /^0[4]\d{8}$/.test(v) || /^0[2378]\d{8}$/.test(v) || /^\+61\d{9}$/.test(v); }

  function clearErrors() {
    Object.keys(FIELDS).forEach(function (k) {
      const input = document.getElementById(FIELDS[k]);
      const err = document.getElementById(FIELDS[k] + "-err");
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
      err.hidden = true; err.textContent = "";
    });
    formErr.hidden = true; formErr.textContent = "";
  }
  function showErrors(keys) {
    keys.forEach(function (k) {
      const input = document.getElementById(FIELDS[k]);
      const err = document.getElementById(FIELDS[k] + "-err");
      err.textContent = MESSAGES[k]; err.hidden = false;
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", err.id);
    });
    if (keys.length) { document.getElementById(FIELDS[keys[0]]).focus(); }
  }
  function validate(d) {
    const bad = [];
    if (!d.name || d.name.length > 80) { bad.push("name"); }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email) || d.email.length > 120) { bad.push("email"); }
    if (d.phone && !phoneOk(cleanPhone(d.phone))) { bad.push("phone"); }
    if (["support_coordinator", "participant_carer", "provider"].indexOf(d.role) === -1) { bad.push("role"); }
    return bad;
  }
  function setSending(on) {
    sending = on;
    submitBtn.disabled = on;
    submitBtn.textContent = on ? "Sending..." : "Get the app";
  }

  function leadEvents() {
    // Custom event: Meta restricts the standard "Lead" on this dataset. Only page and variant - never anything typed.
    zTrack("generate_lead", { page: PIXEL_PAGE, variant: VARIANT });
    if (typeof window.fbq === "function") {
      try { fbq("trackCustom", "SubmitLeadForm", { page: PIXEL_PAGE, variant: VARIANT }, { eventID: newEventId() }); } catch (err) {}
    }
  }

  if (form) {
    form.elements.variant.value = VARIANT;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (sending) { return; }
      clearErrors();
      const d = {
        name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(),
        phone: form.elements.phone.value.trim(),
        role: form.elements.role.value,
        company: form.elements.company.value
      };
      const bad = validate(d);
      if (bad.length) { showErrors(bad); return; }

      setSending(true);
      waitForToken(6000).then(function (token) {
        if (!token && tsWidget !== null && !tsFailed) {      // the check is showing and needs the visitor: ask them to finish it
          setSending(false);
          formErr.textContent = MESSAGES.turnstile; formErr.hidden = false; submitBtn.focus();
          return;
        }
        post(d, token);
      });
    });
  }

  function waitForToken(maxMs) {
    return new Promise(function (resolve) {
      const start = Date.now();
      (function poll() {
        const t = turnstileToken();
        if (t || tsFailed || Date.now() - start >= maxMs) { resolve(t); return; }
        setTimeout(poll, 200);
      })();
    });
  }

  function post(d, token) {
      const qs = new URLSearchParams(location.search);
      const body = {
        name: d.name, email: d.email, phone: d.phone, role: d.role, company: d.company,
        turnstileToken: token, page: PIXEL_PAGE, variant: VARIANT,
        utm_source: qs.get("utm_source") || "", utm_medium: qs.get("utm_medium") || "",
        utm_campaign: qs.get("utm_campaign") || "", utm_content: qs.get("utm_content") || ""
      };
      const first = d.name.indexOf(" ") > -1 ? d.name.slice(0, d.name.lastIndexOf(" ")).trim() : d.name;

      const ctrl = "AbortController" in window ? new AbortController() : null;
      const timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 15000) : null;
      fetch("/api/lead", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (j) { return { status: res.status, j: j }; });
      }).then(function (r) {
        if (timer) { clearTimeout(timer); }
        if (r.status === 200 && r.j && r.j.ok === true) {
          if (!d.company) { leadEvents(); }                    // no event for honeypot hits
          unlock((r.j.first || first || "").trim(), d.role);
          return;
        }
        if (r.status === 400 && r.j && r.j.error) {
          setSending(false);
          if (r.j.error === "turnstile") {
            if (!token || tsFailed) { unlock("", d.role); return; }   // the bot check never loaded: don't block the download
            formErr.textContent = MESSAGES.turnstile; formErr.hidden = false; resetTurnstile(); submitBtn.focus();
            return;
          }
          if (FIELDS[r.j.error]) { showErrors([r.j.error]); return; }
        }
        unlock("", d.role);                                       // server error: unlock, no events, no contact captured
      }).catch(function () {
        if (timer) { clearTimeout(timer); }
        unlock("", d.role);                                       // network error: unlock, no events
      });
  }

  function goToForm(presetRole) {
    if (!leadBox) { return; }
    if (presetRole && roleSelect) { roleSelect.value = presetRole; }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    leadBox.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    if (nameInput) { try { nameInput.focus({ preventScroll: true }); } catch (err) { nameInput.focus(); } }
  }
  document.querySelectorAll("[data-goto-form]").forEach(function (l) {
    l.addEventListener("click", function (e) {
      if (isUnlocked()) { return; }
      e.preventDefault();
      goToForm(l.dataset.presetRole || "");
    });
  });

  // ---- participant panel ----
  const btn = document.getElementById("participant-btn");
  const panel = document.getElementById("participant-panel");
  function openPanel() {
    if (!btn || !panel) { return; }
    panel.hidden = false;
    btn.setAttribute("aria-expanded", "true");
  }
  if (btn && panel) {
    btn.addEventListener("click", function () {
      const open = btn.getAttribute("aria-expanded") === "true";
      panel.hidden = open;
      btn.setAttribute("aria-expanded", open ? "false" : "true");
      if (!open && !isUnlocked()) { goToForm("participant_carer"); }   // locked: open the panel, then go to the form
    });
  }
  document.querySelectorAll("a[data-open-participant]").forEach(function (l) {
    l.addEventListener("click", function (e) {
      openPanel();
      if (!isUnlocked()) { e.preventDefault(); goToForm("participant_carer"); }
      // unlocked: no preventDefault, the anchor still scrolls to the panel
    });
  });

  // ---- sticky bar (under 768px) ----
  const bar = document.getElementById("sticky");
  const hero = document.getElementById("hero");
  const finalCta = document.getElementById("final-cta");
  const narrow = window.matchMedia("(max-width:767.98px)");
  let heroGone = false;
  let finalSeen = false;
  function updateSticky() {
    if (!bar) { return; }
    bar.hidden = !(narrow.matches && heroGone && !finalSeen);
  }
  if (bar && hero && finalCta && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      const en = entries[entries.length - 1];
      heroGone = !en.isIntersecting && en.boundingClientRect.bottom <= 0;
      updateSticky();
    }).observe(hero);
    new IntersectionObserver(function (entries) {
      finalSeen = entries[entries.length - 1].isIntersecting;
      updateSticky();
    }).observe(finalCta);
    if (narrow.addEventListener) { narrow.addEventListener("change", updateSticky); }
    else if (narrow.addListener) { narrow.addListener(updateSticky); }
  }
})();
