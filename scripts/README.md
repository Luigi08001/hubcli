# `scripts/`

Helper scripts used for demos and release tasks.

## Two paired demos

| Artifact | What it shows | How it's produced |
|---|---|---|
| `docs/demo-terminal.gif` | `hscli` taking a portal through **blank → CREATE → associate → READ → UPDATE → ARCHIVE → blank** in the terminal | `vhs scripts/demo.tape` (records `scripts/demo.sh`) |
| `docs/demo-hubspot.gif` | The same records *rendered in the HubSpot UI* — company detail page with associated contacts + closed-won deal | `uv run python scripts/capture-hubspot.py` |

Both are re-rendered from scratch on every refresh — no manual capture.

---

## `demo.sh` → `docs/demo-terminal.gif`

A ~70-second CLI walkthrough:

1. Identifies the authed portal (portal ID deliberately masked)
2. **CREATE** — company `Northwind Trading Co` + 2 exec contacts (Elena Rodriguez · VP Sales, Marcus Chen · Director of Ops) + 1 deal
3. **ASSOCIATE** — both contacts ↔ company, deal ↔ company
4. **READ** — deterministic GET by ID for company + association list
5. **UPDATE** — close the deal @ $142,000, promote Elena to customer
6. **ARCHIVE** — tear the whole fixture down
7. **Summary** — portal back to prior state

Run it:

```bash
./scripts/demo.sh
```

Refresh the GIF:

```bash
vhs scripts/demo.tape
```

The script uses a timestamp-namespaced fixture (e.g. `demo-1714022533`) so concurrent runs never collide, and a `trap` guarantees teardown even on Ctrl-C.

### Prereqs

- `hscli >= 0.8.1` authed against a HubSpot portal
- `jq` (`brew install jq`)
- `vhs` for refreshing the GIF (`brew install vhs`)

---

## `capture-hubspot.py` → `docs/demo-hubspot.gif`

A Playwright script that:

1. Creates the same Northwind Trading fixture via `hscli`
2. Launches headless Chromium with a saved HubSpot session
3. Navigates to the company detail page → shows associated contacts + deal
4. Navigates to the deal detail page → shows the closed-won pipeline state
5. Converts the captured video to `docs/demo-hubspot.{gif,mp4}`
6. Archives the fixture via `hscli`

### Two privacy guardrails

- **Playwright's `page.video()` captures the viewport only**, not Chrome's address bar. The numeric portal ID in the URL never enters the recording.
- **A MutationObserver** injected via `add_init_script` rewrites any remaining occurrences of the portal ID in the DOM (breadcrumbs, "copy link" buttons, `data-*` attributes) to `•••••••••`.

### First-run setup (once per machine)

HubSpot requires auth. Save a session state file once:

```bash
cd scripts
uv sync
uv run playwright install chromium

uv run python capture-hubspot.py --login
# → Chromium window opens on app.hubspot.com
# → log in (passkey / SSO / password — whatever your portal uses)
# → close the window to save the session
# → state persists in scripts/.hubspot-state.json (gitignored)
```

### Refresh the GIF (every subsequent run)

```bash
cd scripts
uv run python capture-hubspot.py
# → runs fully headless
# → ~45s end-to-end
```

### Prereqs

- Python 3.11+, [`uv`](https://github.com/astral-sh/uv)
- `ffmpeg` (`brew install ffmpeg`) — converts Playwright's webm to gif + mp4
- `hscli >= 0.8.1` authed

### Flags

- `--login` — one-time session setup (headed)
- `--keep` — don't archive the fixture after capture (useful if you want to poke at Northwind Trading manually)

---

## Regenerating both demos together

```bash
# Refresh terminal GIF
vhs scripts/demo.tape

# Refresh HubSpot UI GIF
cd scripts && uv run python capture-hubspot.py
```

On a warm portal + cached Playwright browser, both finish in ~2 minutes combined.

---

## Files in `scripts/`

```
demo.sh              — the terminal CRUD walkthrough (bash)
demo.tape            — vhs config (Catppuccin Mocha, 1400×860, 30ms typing)
capture-hubspot.py   — Playwright UI capture (Python)
pyproject.toml       — Python deps (playwright)
.hubspot-state.json  — gitignored, saved after `--login` once
.video-cache/        — gitignored, Playwright's raw webm scratchpad
```
