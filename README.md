# AbleFinder landing pages

Static pages for AbleFinder support coordinator traffic (Western Sydney).

- `/support-coordinators` - upper-funnel landing page
- `/support-coordinators/start` - conversion page

Plain HTML, CSS and vanilla JavaScript. No build step.

## Deploy (Cloudflare Pages)

Build command: none. Output directory: `/`.

## Constants

- `SAM_CONSENT` in `assets/tracking.js` and in the inline script in `support-coordinators/start/index.html`. Keep both equal. Setting both to `true` enables the `?c=days` variant and the testimonial on the landing page.
- `APP_STORE_PT` in `assets/tracking.js`: App Store provider token.
- `SHOW_WEB_APP_LINE` in `assets/tracking.js`: the laptop "Open AbleFinder in your browser" line. Off until web sign-up to find support is live.
- `TURNSTILE_SITE_KEY` in `assets/tracking.js`: the public Turnstile site key (the secret key lives only in Cloudflare as `TURNSTILE_SECRET`).

## Lead form (`functions/api/lead.js`)

The store buttons appear after the form in the hero (`html.unlocked`, remembered as `af_unlocked` in localStorage). The form posts to `/api/lead`, a Cloudflare Pages Function that saves the contact to Bigin (tag `SC WSYD LP`). If Bigin fails, the payload goes to the KV namespace `LEADS_FALLBACK` (90 days) and the page still unlocks. Without JavaScript there is no bot check, so the contact is not saved, but the visitor still gets the store buttons.

On success the page fires the Meta custom event `SubmitLeadForm` (page and variant only - the standard `Lead` is restricted on this dataset) and the GA4 event `generate_lead` through Zaraz.

Cloudflare Pages > Settings > Variables and Secrets (Production and Preview, encrypted):

| Name | What |
|---|---|
| `TURNSTILE_SECRET` | Turnstile secret key |
| `BIGIN_CLIENT_ID`, `BIGIN_CLIENT_SECRET`, `BIGIN_REFRESH_TOKEN` | Zoho Self Client (scopes `ZohoBigin.modules.contacts.ALL,ZohoBigin.settings.fields.READ`) |
| `BIGIN_ACCOUNTS_URL` | `https://accounts.zoho.com.au` (or `.com` if Bigin is on the US data centre) |
| `BIGIN_API_BASE` | `https://www.zohoapis.com.au/bigin/v2` |
| `BIGIN_FIELD_ROLE`, `BIGIN_FIELD_SOURCE`, `BIGIN_FIELD_PAGE`, `BIGIN_FIELD_UTM_CONTENT`, `BIGIN_FIELD_CONSENT`, `BIGIN_FIELD_CONSENT_TEXT` | Only if the API names change. Defaults: AF Role `AF_Source`, AF Source `AF_Source1`, AF Page `AF_Page`, AF UTM Content `AF_UTM_Content`, AF Consent `AF_Consent`, AF Consent Text `AF_Consent_Text` |

Bindings: KV namespace `LEADS_FALLBACK`. Never commit a secret.

The consent line on both pages and `CONSENT_TEXT` in the function must match word for word (the local check tests it).

## Cache

Browsers keep `/assets/*` for up to 4 hours. When `lp.css` or `tracking.js` changes, bump the `?v=` date on their links in both pages (and on `lp.css` in `functions/api/lead.js`) so returning visitors get the new files with the new HTML.

## Placeholders

Search the HTML and `assets/video/same-day-ana.vtt` for `[you to provide` and `[you to confirm`. Each is visible on the page until replaced.

## Local check

`python3 tools/verify/run.py` (needs Google Chrome). Chrome is launched with host rules that block Meta hosts so no test events are sent.
