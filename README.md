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

## Placeholders

Search the HTML and `assets/video/same-day-ana.vtt` for `[you to provide` and `[you to confirm`. Each is visible on the page until replaced.

## Local check

`python3 tools/verify/run.py` (needs Google Chrome). Chrome is launched with host rules that block Meta hosts so no test events are sent.
