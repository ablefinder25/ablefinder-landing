// TEMPORARY setup check for the Bigin connection. Preview addresses only (*.pages.dev).
// Returns status codes and Contacts field names - never keys, tokens or contact details.
// Delete this file before merging to main.

const EXPECTED = {
  BIGIN_FIELD_ROLE: "AF_Role", BIGIN_FIELD_SOURCE: "AF_Source", BIGIN_FIELD_PAGE: "AF_Page",
  BIGIN_FIELD_UTM_CONTENT: "AF_UTM_Content", BIGIN_FIELD_CONSENT: "AF_Consent", BIGIN_FIELD_CONSENT_TEXT: "AF_Consent_Text"
};

function json(status, obj) {
  return new Response(JSON.stringify(obj, null, 2), { status: status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

export async function onRequestGet(context) {
  const env = context.env || {};
  const host = new URL(context.request.url).hostname;
  if (!/\.pages\.dev$/.test(host)) { return json(404, { error: "not_found" }); }

  const out = {
    vars_present: {
      BIGIN_CLIENT_ID: !!env.BIGIN_CLIENT_ID, BIGIN_CLIENT_SECRET: !!env.BIGIN_CLIENT_SECRET,
      BIGIN_REFRESH_TOKEN: !!env.BIGIN_REFRESH_TOKEN, LEADS_FALLBACK: !!env.LEADS_FALLBACK
    },
    accounts_url: env.BIGIN_ACCOUNTS_URL || "(default) https://accounts.zoho.com.au",
    api_base: env.BIGIN_API_BASE || "(default) https://www.zohoapis.com.au/bigin/v2"
  };

  const body = new URLSearchParams({
    refresh_token: String(env.BIGIN_REFRESH_TOKEN || "").trim(), client_id: String(env.BIGIN_CLIENT_ID || "").trim(),
    client_secret: String(env.BIGIN_CLIENT_SECRET || "").trim(), grant_type: "refresh_token"
  });
  const t = await fetch((env.BIGIN_ACCOUNTS_URL || "https://accounts.zoho.com.au") + "/oauth/v2/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body
  });
  const tj = await t.json().catch(function () { return {}; });
  out.token = { status: t.status, ok: !!tj.access_token, error: tj.error || null, api_domain: tj.api_domain || null, scope: tj.scope || null };
  if (!tj.access_token) { return json(200, out); }

  const base = env.BIGIN_API_BASE || "https://www.zohoapis.com.au/bigin/v2";
  const f = await fetch(base + "/settings/fields?module=Contacts", { headers: { "Authorization": "Zoho-oauthtoken " + tj.access_token } });
  const fj = await f.json().catch(function () { return {}; });
  out.fields = { status: f.status, code: fj.code || null };
  const list = (fj.fields || []);
  out.custom_fields = list.filter(function (x) { return x.custom_field; })
    .map(function (x) { return { label: x.field_label, api_name: x.api_name, type: x.data_type, length: x.length }; });
  const names = list.map(function (x) { return x.api_name; });
  out.expected = {};
  Object.keys(EXPECTED).forEach(function (k) {
    const want = env[k] || EXPECTED[k];
    out.expected[k] = { using: want, found: names.indexOf(want) > -1 };
  });
  out.standard_found = ["First_Name", "Last_Name", "Email", "Mobile", "Phone", "Tag"].filter(function (n) { return names.indexOf(n) > -1; });
  return json(200, out);
}
