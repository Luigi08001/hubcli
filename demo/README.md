# hscli + browser-use demo

End-to-end proof that `hscli` actually writes to a HubSpot portal — verified by an AI agent driving a real Chromium against the HubSpot UI, not just the API response.

**Target portal:** `147975758` (HubSpot EU1 test).

## What it does

| Stage | Actor | Action |
|---|---|---|
| A | `hscli` | Creates a unique contact (`demo-{ts}@hscli.dev`) via the CRM v3 API. Captures the returned record ID. |
| B | `browser-use` agent (Claude / GPT) in headful Chromium | Navigates to the portal contacts list, searches for the unique email, clicks into the record, and reports back a JSON verdict. |
| C | `hscli` | Archives the test contact (soft-delete). Pass `--keep` to skip. |

## Prereqs

- macOS or Linux with Chromium or Chrome (browser-use auto-installs Chromium on first run if missing)
- Python 3.11+
- [`uv`](https://github.com/astral-sh/uv) — `brew install uv`
- `hscli >= 0.8.1` installed globally: `npm install -g @revfleet/hscli`
- hscli's default profile authed against portal `147975758`: `hscli auth whoami` should report `portalId: 147975758`
- One of:
  - `ANTHROPIC_API_KEY` — recommended (Claude navigates HubSpot well)
  - `OPENAI_API_KEY`

## Run

```bash
cd demo
uv sync                     # installs browser-use into .venv
uv run python demo.py       # full A → B → C
```

First run: Chromium opens, browser-use navigates to HubSpot. If you're not signed into the portal, **sign in manually in the Chromium window** — the agent waits. After login the agent proceeds, searches, verifies, and returns.

## Flags

- `--keep` — leave the contact in the portal (skip Stage C). Handy if you want to poke at it in the UI yourself after the demo.
- `--skip-browser` — run Stage A + Stage C only (hscli create + archive). Smoke tests hscli without the UI roundtrip.

## Expected output

```
[10:42:13] pre     hscli binary: 0.8.1
[10:42:13] hscli   create contact email=demo-1714022533@hscli.dev
[10:42:14] hscli   created id=47201234567 (HubSpot returned status 20x)
[10:42:14] bu      launching Chromium (non-headless) …
[10:42:17] bu      agent running — sign into HubSpot in the window if prompted
[10:42:58] bu      agent returned

Browser-use agent final result:
{
  "success": true,
  "contact_url": "https://app-eu1.hubspot.com/contacts/147975758/record/0-1/47201234567",
  "observed_email": "demo-1714022533@hscli.dev",
  "notes": "Contact opened cleanly; first name Demo, last name BrowserUse-1714022533"
}

[10:42:58] demo    end-to-end success: true
[10:42:58] hscli   archive id=47201234567
[10:42:59] hscli   archived (soft-delete, restorable from HubSpot UI)
```

## Why this is a useful demo

- **Ground-truth proof** — any 200 response from HubSpot could theoretically be a stub; a browser agent reading the actual HubSpot UI closes that loop.
- **Works across hubs** — the agent follows the UI, not specific selectors, so it survives HubSpot design refreshes.
- **Extensible** — swap the task string in `browser_verify()` to test any other flow (deal creation → pipeline UI check, workflow enrollment → workflow history, form submission → form analytics).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `hscli not found` | `npm install -g @revfleet/hscli`. Check `~/.npm-global/bin` is in your `PATH`. |
| `hscli --version` is silent | You're on <0.8.1 which had a symlink-entry-point regression. Upgrade: `npm install -g @revfleet/hscli@latest`. |
| Agent stalls on a login page | Sign in manually in the Chromium window browser-use opens; the agent resumes once the URL matches the contacts list. |
| Agent can't find the contact after login | Rare — usually HubSpot's search is indexing. Re-run the demo; a second contact with a new timestamp will land immediately. |
| Chromium fails to launch | `uv run playwright install chromium` (browser-use uses Playwright's bundled Chromium). |
