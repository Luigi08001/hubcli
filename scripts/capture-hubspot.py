"""
Record a LIVE walkthrough of hscli writing into a HubSpot portal.

Unlike a static "create everything up-front then take screenshots" flow,
this script interleaves hscli calls with Playwright page reloads, so the
viewer actually sees records appear in the HubSpot UI one at a time:

  1. Company page opens — empty (no associated contacts, no deals).
  2. hscli creates Elena → reload → Elena appears in the Contacts panel.
  3. hscli creates Marcus → reload → Marcus appears alongside Elena.
  4. hscli creates the deal → reload → deal + contact roster now attached.
  5. Navigate to the deal page → closedwon, $142k, contacts attached.

A narration banner overlays each step with the hscli command in flight,
so the causal link between terminal and UI is visible.

Privacy guardrails (same as before):
  - Viewport-only video (URL bar with portal ID is excluded).
  - MutationObserver rewrites any portal-ID occurrence in the DOM to •s.

Prereqs (once):
  - Python 3.11+, uv
  - `uv run playwright install chromium`
  - `uv run python capture-hubspot.py --login`

Then:
  `uv run python capture-hubspot.py`
produces docs/demo-hubspot.{gif,mp4} fully headless.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
DOCS_DIR = SCRIPTS_DIR.parent / "docs"
STATE_FILE = SCRIPTS_DIR / ".hubspot-state.json"

TS = int(time.time())
NS = f"demo-{TS}"
COMPANY_NAME = "Northwind Trading Co"
DEAL_NAME = "Northwind — Enterprise Renewal 2026"
EMAIL_VP = f"elena.rodriguez+{NS}@hscli.dev"
EMAIL_OPS = f"marcus.chen+{NS}@hscli.dev"


def log(stage: str, msg: str) -> None:
    ts = time.strftime("%H:%M:%S")
    print(f"[{ts}] {stage:7}  {msg}", flush=True)


def hscli(*args: str, data: dict | None = None) -> dict:
    """Run hscli as a subprocess and return its JSON envelope."""
    cmd = ["hscli", "--force", "--json", *args]
    if data is not None:
        cmd += ["--data", json.dumps(data)]
    out = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=60)
    payload = json.loads(out.stdout)
    if not payload.get("ok"):
        raise RuntimeError(f"hscli failed: {payload}")
    return payload["data"]


def hscli_silent(*args: str) -> None:
    """Fire-and-forget — swallow errors, used for teardown."""
    subprocess.run(
        ["hscli", "--force", "--json", *args],
        capture_output=True, text=True, check=False, timeout=60,
    )


# ───────────────────────────────────────────────────────────────────────────
# Atomic fixture helpers — used one-at-a-time between page reloads
# ───────────────────────────────────────────────────────────────────────────


def create_company() -> str:
    return hscli(
        "crm", "companies", "create",
        data={"properties": {
            "name": COMPANY_NAME,
            "domain": f"{NS}.northwind-trading.hscli.dev",
            "industry": "COMPUTER_SOFTWARE",
            "numberofemployees": "420",
            "annualrevenue": "48000000",
        }},
    )["id"]


def create_contact(email: str, first: str, last: str, title: str, phone: str) -> str:
    return hscli(
        "crm", "contacts", "create",
        data={"properties": {
            "email": email, "firstname": first, "lastname": last,
            "jobtitle": title, "phone": phone,
        }},
    )["id"]


def create_deal() -> str:
    return hscli(
        "crm", "deals", "create",
        data={"properties": {
            "dealname": DEAL_NAME,
            "amount": "142000",
            "dealstage": "closedwon",
            "pipeline": "default",
            "closedate": "2026-09-30",
        }},
    )["id"]


def associate(from_type: str, from_id: str, to_type: str, to_id: str) -> None:
    hscli("crm", "associations", "create", from_type, from_id, to_type, to_id)


def archive_all(ids: dict) -> None:
    for kind in ("deal_id", "contact_vp", "contact_ops", "company_id"):
        value = ids.get(kind)
        if not value:
            continue
        endpoint = {
            "deal_id": ("crm", "deals", "delete"),
            "contact_vp": ("crm", "contacts", "delete"),
            "contact_ops": ("crm", "contacts", "delete"),
            "company_id": ("crm", "companies", "delete"),
        }[kind]
        hscli_silent(*endpoint, value)


def fetch_portal_id() -> str | None:
    try:
        out = subprocess.run(
            ["hscli", "--json", "account", "info"],
            capture_output=True, text=True, check=True, timeout=30,
        )
        pid = json.loads(out.stdout).get("data", {}).get("portalId")
        return str(pid) if pid else None
    except Exception:  # noqa: BLE001
        return None


def fetch_ui_domain() -> str:
    try:
        out = subprocess.run(
            ["hscli", "--json", "account", "info"],
            capture_output=True, text=True, check=True, timeout=30,
        )
        return json.loads(out.stdout)["data"]["uiDomain"]
    except Exception:  # noqa: BLE001
        return "app.hubspot.com"


# ───────────────────────────────────────────────────────────────────────────
# Playwright — init script (portal-ID mask + narration banner that
# survives page reloads via localStorage)
# ───────────────────────────────────────────────────────────────────────────


def build_init_script(portal_id: str | None) -> str:
    mask_js = ""
    if portal_id:
        mask_js = (
            "const portalRe = new RegExp(%s, 'g');" % json.dumps(portal_id)
            + "const mask = '\\u2022'.repeat(%d);" % len(portal_id)
            + """
            const scrub = (node) => {
              if (!node) return;
              const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
              let n;
              while ((n = walker.nextNode())) {
                if (portalRe.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(portalRe, mask);
              }
              if (node.nodeType === 1) {
                for (const el of node.querySelectorAll('*')) {
                  for (const attr of el.attributes) {
                    if (portalRe.test(attr.value)) {
                      el.setAttribute(attr.name, attr.value.replace(portalRe, mask));
                    }
                  }
                }
              }
            };
            const bootScrub = () => {
              scrub(document.documentElement);
              new MutationObserver((muts) => {
                for (const m of muts) {
                  for (const node of m.addedNodes) scrub(node);
                  if (m.type === 'characterData') scrub(m.target);
                }
              }).observe(document.documentElement, {
                childList: true, subtree: true, characterData: true, attributes: true,
              });
            };
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', bootScrub, { once: true });
            } else {
              bootScrub();
            }
            """
        )

    return r"""
(() => {
  %s

  // Narration banner — pulls current text from localStorage so it
  // survives page.reload() calls. Style tuned for readability over
  // HubSpot's content without obscuring the record details.
  const bootBanner = () => {
    const text = window.localStorage.getItem('hscli_demo_banner') || '';
    if (!text) return;
    let el = document.getElementById('hscli-demo-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'hscli-demo-banner';
      el.style.cssText = [
        'position:fixed', 'top:20px', 'right:20px', 'z-index:2147483647',
        'background:rgba(17,17,27,0.96)', 'color:#a6e3a1',
        'border:1px solid #45475a', 'border-radius:10px',
        'padding:14px 18px', 'max-width:520px',
        'font-family:ui-monospace,SFMono-Regular,Menlo,monospace',
        'font-size:13px', 'line-height:1.45',
        'box-shadow:0 10px 28px rgba(0,0,0,0.55)',
        'backdrop-filter:blur(6px)',
      ].join(';');
      document.documentElement.appendChild(el);
    }
    el.textContent = text;
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootBanner, { once: true });
  } else {
    bootBanner();
  }
  new MutationObserver(bootBanner).observe(document.documentElement, {
    childList: true, subtree: true,
  });
})();
""" % mask_js


# ───────────────────────────────────────────────────────────────────────────
# Live tour
# ───────────────────────────────────────────────────────────────────────────


async def do_login() -> int:
    from playwright.async_api import async_playwright

    ui_domain = fetch_ui_domain()
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        log("login", f"Opening https://{ui_domain}/ — sign in, then close the window.")
        await page.goto(f"https://{ui_domain}/", wait_until="domcontentloaded", timeout=120_000)
        try:
            await page.wait_for_event("close", timeout=10 * 60 * 1000)
        except Exception:
            pass
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        await context.storage_state(path=str(STATE_FILE))
        await browser.close()
    log("login", f"saved storageState → {STATE_FILE}")
    return 0


async def capture_live_tour(portal_id: str | None, ui_domain: str) -> tuple[Path, dict]:
    """Run the live CRUD walkthrough inside a recorded Playwright session.

    Returns the raw video path + the IDs so the caller can clean up.
    """
    from playwright.async_api import async_playwright

    if not STATE_FILE.exists():
        raise SystemExit(
            "No saved HubSpot session. Run first:  "
            "cd scripts && uv run python capture-hubspot.py --login"
        )

    video_dir = SCRIPTS_DIR / ".video-cache"
    shutil.rmtree(video_dir, ignore_errors=True)
    video_dir.mkdir(parents=True)

    init_script = build_init_script(portal_id)

    # Seed ids dict early so an exception still allows cleanup
    ids: dict = {}

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            storage_state=str(STATE_FILE),
            record_video_dir=str(video_dir),
            record_video_size={"width": 1400, "height": 860},
            viewport={"width": 1400, "height": 860},
        )
        await context.add_init_script(init_script)
        page = await context.new_page()

        async def set_banner(text: str, hold_ms: int = 1500) -> None:
            """Set the narration banner and give viewers time to read it."""
            safe = json.dumps(text)
            await page.evaluate(
                f"""
                (t) => {{
                  window.localStorage.setItem('hscli_demo_banner', t);
                  let el = document.getElementById('hscli-demo-banner');
                  if (!el) {{
                    el = document.createElement('div');
                    el.id = 'hscli-demo-banner';
                    el.style.cssText = 'position:fixed;top:20px;right:20px;z-index:2147483647;background:rgba(17,17,27,0.96);color:#a6e3a1;border:1px solid #45475a;border-radius:10px;padding:14px 18px;max-width:520px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:1.45;box-shadow:0 10px 28px rgba(0,0,0,0.55);backdrop-filter:blur(6px)';
                    document.documentElement.appendChild(el);
                  }}
                  el.textContent = t;
                }}
                """,
                text,
            )
            await page.wait_for_timeout(hold_ms)

        async def scroll_to_associations() -> None:
            """Reveal the Contacts + Deals association panels on the right side."""
            await page.mouse.wheel(0, 700)
            await page.wait_for_timeout(700)

        async def wait_hubspot_settled(seconds: float = 2.0) -> None:
            """HubSpot's SPA keeps polling after networkidle; give it time."""
            try:
                await page.wait_for_load_state("networkidle", timeout=10_000)
            except Exception:
                pass
            await page.wait_for_timeout(int(seconds * 1000))

        # ── Act 1: create empty company, open its page ────────────────────
        log("act", "1. create empty company, open the company page")
        ids["company_id"] = create_company()
        company_url = (
            f"https://{ui_domain}/contacts/{portal_id}/record/0-2/{ids['company_id']}"
            if portal_id
            else f"https://{ui_domain}/"
        )
        await page.goto(company_url, wait_until="domcontentloaded", timeout=60_000)
        await wait_hubspot_settled(1.8)
        await set_banner(
            "$ hscli --force crm companies create  → Northwind Trading Co",
            hold_ms=1800,
        )
        await scroll_to_associations()
        await set_banner(
            "Company page loads — associations panel is empty.",
            hold_ms=1800,
        )

        # ── Act 2: contact #1 appears ─────────────────────────────────────
        log("act", "2. create Elena + associate → reload, she should appear")
        await set_banner(
            "$ hscli --force crm contacts create  → Elena Rodriguez · VP of Sales",
            hold_ms=1200,
        )
        ids["contact_vp"] = create_contact(
            EMAIL_VP, "Elena", "Rodriguez", "VP of Sales", "+1-415-555-0182",
        )
        associate("contacts", ids["contact_vp"], "companies", ids["company_id"])
        await asyncio.sleep(1.5)
        await page.reload(wait_until="domcontentloaded")
        await wait_hubspot_settled(1.8)
        await scroll_to_associations()
        await set_banner(
            "↻ UI refreshed  → Elena now appears in the Contacts panel.",
            hold_ms=2200,
        )

        # ── Act 3: contact #2 appears ─────────────────────────────────────
        log("act", "3. create Marcus → reload, 2 contacts visible")
        await set_banner(
            "$ hscli --force crm contacts create  → Marcus Chen · Director of Operations",
            hold_ms=1200,
        )
        ids["contact_ops"] = create_contact(
            EMAIL_OPS, "Marcus", "Chen", "Director of Operations", "+1-415-555-0147",
        )
        associate("contacts", ids["contact_ops"], "companies", ids["company_id"])
        await asyncio.sleep(1.5)
        await page.reload(wait_until="domcontentloaded")
        await wait_hubspot_settled(1.8)
        await scroll_to_associations()
        await set_banner(
            "↻ UI refreshed  → Marcus joins Elena on the account.",
            hold_ms=2200,
        )

        # ── Act 4: deal appears ───────────────────────────────────────────
        log("act", "4. create deal + associate → reload, deal in the Deals panel")
        await set_banner(
            "$ hscli --force crm deals create  → Enterprise Renewal · $142,000 · closedwon",
            hold_ms=1200,
        )
        ids["deal_id"] = create_deal()
        associate("deals", ids["deal_id"], "companies", ids["company_id"])
        associate("contacts", ids["contact_vp"], "deals", ids["deal_id"])
        associate("contacts", ids["contact_ops"], "deals", ids["deal_id"])
        await asyncio.sleep(2)
        await page.reload(wait_until="domcontentloaded")
        await wait_hubspot_settled(1.8)
        await scroll_to_associations()
        await set_banner(
            "↻ UI refreshed  → closedwon deal attached · contacts roster filled.",
            hold_ms=2400,
        )

        # ── Act 5: show the deal page ─────────────────────────────────────
        log("act", "5. navigate to the deal page, show closedwon + attached contacts")
        await set_banner(
            "→ Deal record: pipeline stage closedwon, $142,000, contacts attached.",
            hold_ms=1200,
        )
        deal_url = (
            f"https://{ui_domain}/contacts/{portal_id}/record/0-3/{ids['deal_id']}"
            if portal_id
            else f"https://{ui_domain}/"
        )
        await page.goto(deal_url, wait_until="domcontentloaded", timeout=60_000)
        await wait_hubspot_settled(2)
        await scroll_to_associations()
        await set_banner(
            "Deal opened — same company, same 2-person roster — all from the CLI.",
            hold_ms=2500,
        )

        # ── Final hold ────────────────────────────────────────────────────
        await set_banner(
            "Company · 2 contacts · 1 deal · 5 associations — entirely via hscli.",
            hold_ms=2500,
        )

        await context.close()
        await browser.close()

    videos = list((SCRIPTS_DIR / ".video-cache").glob("*.webm"))
    if not videos:
        raise RuntimeError("Playwright produced no video")
    return videos[0], ids


# ───────────────────────────────────────────────────────────────────────────
# Convert webm → gif + mp4
# ───────────────────────────────────────────────────────────────────────────


def convert_to_gif(src: Path, dest_gif: Path, dest_mp4: Path) -> None:
    dest_gif.parent.mkdir(parents=True, exist_ok=True)

    subprocess.run(
        [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-i", str(src),
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            "-crf", "23", "-preset", "medium",
            str(dest_mp4),
        ],
        check=True,
    )

    palette = dest_gif.parent / ".demo-palette.png"
    subprocess.run(
        [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-i", str(src),
            "-vf", "fps=8,scale=900:-1:flags=lanczos,palettegen=max_colors=128",
            str(palette),
        ],
        check=True,
    )
    subprocess.run(
        [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-i", str(src),
            "-i", str(palette),
            "-lavfi",
            "fps=8,scale=900:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5",
            str(dest_gif),
        ],
        check=True,
    )
    palette.unlink(missing_ok=True)


# ───────────────────────────────────────────────────────────────────────────
# main
# ───────────────────────────────────────────────────────────────────────────


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("--login", action="store_true",
                        help="One-time headed login → saves scripts/.hubspot-state.json")
    parser.add_argument("--keep", action="store_true",
                        help="Don't archive the fixture after capture")
    args = parser.parse_args()

    if args.login:
        return await do_login()

    portal_id = fetch_portal_id()
    ui_domain = fetch_ui_domain()
    if not portal_id:
        log("warn", "could not resolve portal ID — UI masking will be skipped")

    ids: dict = {}
    try:
        src_video, ids = await capture_live_tour(portal_id, ui_domain)
        log("demo", f"captured: {src_video}")
        convert_to_gif(src_video, DOCS_DIR / "demo-hubspot.gif", DOCS_DIR / "demo-hubspot.mp4")
        log("demo", f"wrote {DOCS_DIR / 'demo-hubspot.gif'}")
    finally:
        if args.keep:
            log("demo", f"--keep: leaving fixture in portal: {ids}")
        else:
            log("demo", f"archiving fixture: {list(ids.values())}")
            archive_all(ids)

    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
