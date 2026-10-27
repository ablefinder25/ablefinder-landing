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
    });
  }
  document.querySelectorAll("a[data-open-participant]").forEach(function (l) {
    l.addEventListener("click", openPanel);                  // no preventDefault: the anchor still scrolls
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
