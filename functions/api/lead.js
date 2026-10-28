/* POST /api/lead - lead form on the support coordinator pages -> Bigin contact.
   Order: honeypot, Turnstile, validation, phone. Bigin failure -> KV backup, page still unlocks.
   Never log a secret, name, email or phone. */

// Must match the consent line on both pages word for word (the tests check it).
export const CONSENT_TEXT = "By tapping Get the app, you agree to receive emails from AbleFinder - and a call if you add your number. Unsubscribe any time.";
const TAG = "SC WSYD LP";
const SOURCE = "meta-lp";
const ROLES = { support_coordinator: "Support coordinator", participant_carer: "Participant or carer", provider: "Provider" };
const PAGES = ["sc-landing", "sc-start"];
const MAX_BODY = 10000;
const KV_TTL = 90 * 24 * 60 * 60;

// Bigin custom field API names: set these in Cloudflare (Settings > Variables), no code change needed.
// Bigin API names as created in this account: "AF Role" got AF_Source and "AF Source" got AF_Source1.
function fieldNames(env) {
  return {
    role: env.BIGIN_FIELD_ROLE || "AF_Source",
    source: env.BIGIN_FIELD_SOURCE || "AF_Source1",
    page: env.BIGIN_FIELD_PAGE || "AF_Page",
    utmContent: env.BIGIN_FIELD_UTM_CONTENT || "AF_UTM_Content",
    consent: env.BIGIN_FIELD_CONSENT || "AF_Consent",
    consentText: env.BIGIN_FIELD_CONSENT_TEXT || "AF_Consent_Text"
  };
}

function json(status, obj) {
  return new Response(JSON.stringify(obj), { status: status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

export function splitName(full) {
  const n = String(full || "").trim().replace(/\s+/g, " ");
  const i = n.lastIndexOf(" ");
  return i === -1 ? { first: "", last: n } : { first: n.slice(0, i), last: n.slice(i + 1) };
}

// Australian numbers -> +61. Returns null when invalid.
export function normalisePhone(raw) {
  const p = String(raw || "").replace(/[\s()\-]/g, "");
  let m;
  if ((m = /^0([4]\d{8})$/.exec(p)) || (m = /^0([2378]\d{8})$/.exec(p))) { return "+61" + m[1]; }
  if (/^\+61\d{9}$/.test(p)) { return p; }
  return null;
}

export function sydneyIso(date) {
  const f = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZoneName: "longOffset"
  });
  const p = {};
  f.formatToParts(date).forEach(function (x) { p[x.type] = x.value; });
  const off = (p.timeZoneName || "GMT+10:00").replace("GMT", "") || "+00:00";
  return p.year + "-" + p.month + "-" + p.day + "T" + p.hour + ":" + p.minute + ":" + p.second + (off.length === 3 ? off + ":00" : off);
}

function cleanPage(page, variant) {
  const pg = PAGES.indexOf(page) > -1 ? page : "unknown";
  const v = /^[a-z]{1,12}$/.test(String(variant || "")) ? variant : "default";
  return { page: pg, variant: v };
}

async function verifyTurnstile(token, secret, ip) {
  const fd = new FormData();
  fd.append("secret", secret);
  fd.append("response", token);
  if (ip) { fd.append("remoteip", ip); }
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: fd });
    const j = await r.json();
    return { ok: !!j && j.success === true, codes: (j && j["error-codes"]) || [] };
  } catch (e) { return { ok: false, codes: ["siteverify-unreachable"] }; }
}

let cachedToken = null;   // reused while this worker instance is warm
async function biginToken(env) {
  if (cachedToken && cachedToken.exp > Date.now() + 60000) { return cachedToken.value; }
  const body = new URLSearchParams({
    refresh_token: env.BIGIN_REFRESH_TOKEN || "", client_id: env.BIGIN_CLIENT_ID || "",
    client_secret: env.BIGIN_CLIENT_SECRET || "", grant_type: "refresh_token"
  });
  const r = await fetch((env.BIGIN_ACCOUNTS_URL || "https://accounts.zoho.com.au") + "/oauth/v2/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body
  });
  const j = await r.json().catch(function () { return {}; });
  if (!r.ok || !j.access_token) { throw { stage: "token", status: r.status, code: j.error || "no_token" }; }
  cachedToken = { value: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  return j.access_token;
}

function recordOk(j) {
  const d = j && j.data && j.data[0];
  return !!d && (d.status === "success" || d.code === "SUCCESS");
}

async function saveToBigin(env, record) {
  const token = await biginToken(env);
  const base = env.BIGIN_API_BASE || "https://www.zohoapis.com.au/bigin/v2";
  const headers = { "Authorization": "Zoho-oauthtoken " + token, "Content-Type": "application/json" };

  // Create or update, found by email, so a repeat visitor updates their record.
  const up = await fetch(base + "/Contacts/upsert", {
    method: "POST", headers: headers, body: JSON.stringify({ data: [record], duplicate_check_fields: ["Email"] })
  });
  const uj = await up.json().catch(function () { return {}; });
  if (up.ok && recordOk(uj)) { return; }
  const noUpsert = up.status === 404 || up.status === 405 || (up.status === 400 && /NOT_SUPPORTED|INVALID_URL/.test(String(uj.code || "")));
  if (!noUpsert) {
    throw { stage: "upsert", status: up.status, code: (uj.data && uj.data[0] && uj.data[0].code) || uj.code || "error" };
  }

  // Upsert not available on this account: search by email, then update or create.
  const s = await fetch(base + "/Contacts/search?email=" + encodeURIComponent(record.Email), { headers: headers });
  const sj = s.status === 204 ? {} : await s.json().catch(function () { return {}; });
  const existing = sj && sj.data && sj.data[0] && sj.data[0].id;
  const w = await fetch(base + "/Contacts", {
    method: existing ? "PUT" : "POST", headers: headers,
    body: JSON.stringify({ data: [existing ? Object.assign({ id: existing }, record) : record] })
  });
  const wj = await w.json().catch(function () { return {}; });
  if (!(w.ok && recordOk(wj))) {
    throw { stage: existing ? "update" : "create", status: w.status, code: (wj.data && wj.data[0] && wj.data[0].code) || wj.code || "error" };
  }
}

async function backup(env, payload, err) {
  // No name, email or phone in the log - only where it failed.
  console.error("Bigin failed", JSON.stringify({ stage: err && err.stage, status: err && err.status, code: err && err.code }));
  if (!env.LEADS_FALLBACK) { console.error("LEADS_FALLBACK KV not bound - lead not backed up"); return; }
  const key = new Date().toISOString() + "-" + Math.random().toString(36).slice(2, 10);
  try { await env.LEADS_FALLBACK.put(key, JSON.stringify(payload), { expirationTtl: KV_TTL }); }
  catch (e) { console.error("KV backup failed"); }
}

function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }

// Without JavaScript there is no bot check, so the contact is NOT saved. The visitor still gets the app.
export function thankYouPage(page, variant) {
  const ct = page + "-" + variant;
  const ios = "https://apps.apple.com/au/app/ablefinder/id6751715948?pt=128092141&ct=" + encodeURIComponent(ct) + "&mt=8";
  const play = "https://play.google.com/store/apps/details?id=com.ablefinder.ablefinder&referrer=" +
    encodeURIComponent("utm_source=meta&utm_medium=paid_social&utm_campaign=sc-wsyd&utm_content=" + ct);
  return '<!doctype html><html lang="en-AU" class="unlocked"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Get the app | AbleFinder</title><meta name="robots" content="noindex"><link rel="stylesheet" href="/assets/lp.css"></head>' +
    '<body data-page="' + esc(page) + '"><header class="site-header"><div class="wrap site-header__in"><a id="logo" href="/support-coordinators/"><img src="/assets/img/logo-colour.png" alt="AbleFinder - finding NDIS support should be simple" width="152" height="40"></a></div></header>' +
    '<main id="main"><section class="sec hero"><div class="wrap"><p class="lead__done">You\'re in. Download AbleFinder and post your first request.</p>' +
    '<div class="store-badges"><a href="' + esc(ios) + '" class="store-badge store-badge--ios"><img src="/assets/badge-app-store.svg" alt="Download AbleFinder on the App Store" width="144" height="48"></a>' +
    '<a href="' + esc(play) + '" class="store-badge store-badge--android"><img src="/assets/badge-google-play.svg" alt="Get AbleFinder on Google Play" width="162" height="48"></a></div>' +
    '<p class="cta-note">Free for support coordinators, participants and carers.</p></div></section></main>' +
    '<footer class="site-footer"><div class="wrap"><p>AbleFinder Pty Ltd ABN 23 683 642 337</p><p><a class="footer-link" href="https://www.ablefinder.net.au/privacy-policy">Privacy policy</a></p></div></footer></body></html>';
}

export async function onRequestPost(context) {
  const request = context.request, env = context.env || {};
  const type = (request.headers.get("Content-Type") || "").toLowerCase();
  const raw = await request.text();
  if (raw.length > MAX_BODY) { return json(413, { error: "too_large" }); }

  if (type.indexOf("application/json") === -1) {
    const f = new URLSearchParams(raw);
    const c = cleanPage(f.get("page"), f.get("variant"));
    return new Response(thankYouPage(c.page, c.variant), { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }

  let b;
  try { b = JSON.parse(raw); } catch (e) { return json(400, { error: "bad_request" }); }
  if (!b || typeof b !== "object") { return json(400, { error: "bad_request" }); }

  // 1. honeypot: bots get no hint
  if (String(b.company || "").trim() !== "") { return json(200, { ok: true }); }

  // 2. Turnstile
  if (!env.TURNSTILE_SECRET) { console.error("TURNSTILE_SECRET not set"); return json(500, { error: "config" }); }
  const ts = await verifyTurnstile(String(b.turnstileToken || ""), String(env.TURNSTILE_SECRET).trim(), request.headers.get("CF-Connecting-IP"));
  if (!ts.ok) { return json(400, { error: "turnstile", codes: ts.codes }); }   // Cloudflare's error codes only, e.g. invalid-input-secret

  // 3. validation
  const name = String(b.name || "").trim();
  const email = String(b.email || "").trim().toLowerCase();
  const role = String(b.role || "");
  if (name.length < 1 || name.length > 80) { return json(400, { error: "name" }); }
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { return json(400, { error: "email" }); }
  if (!ROLES[role]) { return json(400, { error: "role" }); }

  // 4. phone (optional)
  const phoneRaw = String(b.phone || "").trim();
  let phone = null;
  if (phoneRaw !== "") {
    phone = normalisePhone(phoneRaw);
    if (!phone) { return json(400, { error: "phone" }); }
  }

  const n = splitName(name);
  const pv = cleanPage(b.page, b.variant);
  const F = fieldNames(env);
  const record = { First_Name: n.first, Last_Name: n.last, Email: email, Tag: [{ name: TAG }] };
  if (phone) { record[/^\+614/.test(phone) ? "Mobile" : "Phone"] = phone; }
  record[F.role] = ROLES[role];
  record[F.source] = SOURCE;
  record[F.page] = pv.page + "-" + pv.variant;
  record[F.utmContent] = String(b.utm_content || "").slice(0, 255);
  record[F.consent] = sydneyIso(new Date());
  record[F.consentText] = CONSENT_TEXT;

  try {
    await saveToBigin(env, record);
    return json(200, { ok: true, first: n.first });
  } catch (err) {
    await backup(env, {
      record: record,
      utm: { source: String(b.utm_source || ""), medium: String(b.utm_medium || ""), campaign: String(b.utm_campaign || ""), content: String(b.utm_content || "") }
    }, err && err.stage ? err : { stage: "network" });
    return json(200, { ok: true, fallback: true, first: n.first });
  }
}

export function onRequest(context) {
  if (context.request.method === "POST") { return onRequestPost(context); }
  return json(405, { error: "method" });
}
