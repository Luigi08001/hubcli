"""
Capture a HubSpot UI walkthrough of the demo records.

Pairs with scripts/demo.sh — after the CRUD script runs, this script
creates the same Northwind Trading fixture (1 company + 2 contacts +
1 deal + associations), drives a real Chromium against the HubSpot
portal, records the navigation, archives the fixture, and produces
docs/demo-hubspot.gif.

Two privacy guardrails:

  1. Playwright's page.video() captures the PAGE VIEWPORT only, not
     Chrome's address bar — so the portal ID in the URL is naturally
     excluded from the recording.

  2. An init-script injects a MutationObserver that rewrites any
     occurrence of the numeric portal ID in the DOM text to a mask
     of `•`s, covering breadcrumbs, "copy link" buttons, and any
     stray references inside HubSpot's UI.

Prereqs (once, then never again):
  - Python 3.11+, uv
  - `cd scripts && uv run playwright install chromium`
  - Log into HubSpot once in a headed Chromium:
      `cd scripts && uv run python capture-hubspot.py --login`
    This saves storage state to scripts/.hubspot-state.json (gitignored).

Then:
  `cd scripts && uv run python capture-hubspot.py`
produces docs/demo-hubspot.{gif,mp4} fully headless — no user input.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
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


def run(cmd: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, capture_output=True, text=True, check=check, timeout=60)


# ───────────────────────────────────────────────────────────────────────────
# hscli fixture — mirrors scripts/demo.sh so the UI shows meaningful data
# ───────────────────────────────────────────────────────────────────────────


def hscli_create_fixture() -> dict:
    """Create 1 company + 2 contacts + 1 deal + 3 associations. Returns IDs."""

    def _create(endpoint: str, data: dict) -> str:
        out = run(["hscli", "--force", "--json", *endpoint.split(), "--data", json.dumps(data)])
        payload = json.loads(out.stdout)
        if not payload.get("ok"):
            raise RuntimeError(f"hscli create failed: {payload}")
        return str(payload["data"]["id"])

    log("hscli", "create company Northwind Trading Co")
    company_id = _create(
        "crm companies create",
        {"properties": {
            "name": COMPANY_NAME,
            "domain": f"{NS}.northwind-trading.hscli.dev",
            "industry": "COMPUTER_SOFTWARE",
            "numberofemployees": "420",
            "annualrevenue": "48000000",
        }},
    )

    log("hscli", "create contact Elena Rodriguez — VP Sales")
    contact_vp = _create(
        "crm contacts create",
        {"properties": {
            "email": EMAIL_VP,
            "firstname": "Elena", "lastname": "Rodriguez",
            "jobtitle": "VP of Sales",
            "phone": "+1-415-555-0182",
        }},
    )

    log("hscli", "create contact Marcus Chen — Director of Ops")
    contact_ops = _create(
        "crm contacts create",
        {"properties": {
            "email": EMAIL_OPS,
            "firstname": "Marcus", "lastname": "Chen",
            "jobtitle": "Director of Operations",
            "phone": "+1-415-555-0147",
        }},
    )

    log("hscli", "create deal Northwind Enterprise Renewal — $142,000 closedwon")
    deal_id = _create(
        "crm deals create",
        {"properties": {
            "dealname": DEAL_NAME,
            "amount": "142000",
            "dealstage": "closedwon",
            "pipeline": "default",
            "closedate": "2026-09-30",
        }},
    )

    # Promote Elena to customer so the lifecyclestage badge shows up in the UI
    run([
        "hscli", "--force", "--json",
        "crm", "contacts", "update", contact_vp,
        "--data", json.dumps({"properties": {"lifecyclestage": "customer"}}),
    ])

    # Associations — contacts+deal ↔ company, and contacts ↔ deal, so the
    # deal detail page renders the same roster of people as the company page.
    log("hscli", "associate contacts + deal → company")
    for from_type, from_id in [("contacts", contact_vp), ("contacts", contact_ops), ("deals", deal_id)]:
        run(["hscli", "--force", "--json",
             "crm", "associations", "create", from_type, from_id, "companies", company_id])
    log("hscli", "associate contacts → deal")
    for contact_id in (contact_vp, contact_ops):
        run(["hscli", "--force", "--json",
             "crm", "associations", "create", "contacts", contact_id, "deals", deal_id])

    return {
        "company_id": company_id,
        "contact_vp": contact_vp,
        "contact_ops": contact_ops,
        "deal_id": deal_id,
    }


def hscli_archive_fixture(ids: dict) -> None:
    """Best-effort teardown — swallows errors since this is demo cleanup."""
    for kind in ("deal_id", "contact_vp", "contact_ops", "company_id"):
        record_id = ids.get(kind)
        if not record_id:
            continue
        endpoint = {
            "deal_id": "crm deals delete",
            "contact_vp": "crm contacts delete",
            "contact_ops": "crm contacts delete",
            "company_id": "crm companies delete",
        }[kind]
        run(
            ["hscli", "--force", "--json", *endpoint.split(), record_id],
            check=False,
        )


def fetch_portal_id() -> str | None:
    """Grab the portal ID so we can scrub it from the UI recording."""
    try:
        out = run(["hscli", "--json", "account", "info"])
        pid = json.loads(out.stdout).get("data", {}).get("portalId")
        return str(pid) if pid else None
    except Exception:  # noqa: BLE001
        return None


def fetch_ui_domain() -> str:
    try:
        out = run(["hscli", "--json", "account", "info"])
        return json.loads(out.stdout)["data"]["uiDomain"]
    except Exception:  # noqa: BLE001
        return "app.hubspot.com"


# ───────────────────────────────────────────────────────────────────────────
# Playwright workflow
# ───────────────────────────────────────────────────────────────────────────


PORTAL_MASK_INIT_SCRIPT_TEMPLATE = r"""
(() => {
  const portalId = %s;
  const mask = '•'.repeat(String(portalId).length);
  const re = new RegExp(portalId, 'g');

  const scrub = (node) => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
    let n;
    while ((n = walker.nextNode())) {
      if (re.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(re, mask);
    }
    // Attribute values (href, title, data-*) that may leak the ID too.
    if (node.nodeType === 1) {
      for (const el of node.querySelectorAll('*')) {
        for (const attr of el.attributes) {
          if (re.test(attr.value)) el.setAttribute(attr.name, attr.value.replace(re, mask));
        }
      }
    }
  };

  const boot = () => {
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
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
"""


async def do_login() -> int:
    """Interactive headed login to save storageState. Runs once per machine."""
    from playwright.async_api import async_playwright

    ui_domain = fetch_ui_domain()
    login_url = f"https://{ui_domain}/"

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        log("login", f"Opening {login_url} — sign into HubSpot in the window.")
        log("login", "When the contacts list loads, CLOSE the window to save state.")
        await page.goto(login_url, wait_until="domcontentloaded", timeout=120_000)
        try:
            # Wait up to 10 min for the user to finish login; context closes on window close.
            await page.wait_for_event("close", timeout=10 * 60 * 1000)
        except Exception:
            pass
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        await context.storage_state(path=str(STATE_FILE))
        await browser.close()
    log("login", f"Saved storageState → {STATE_FILE}")
    return 0


async def capture_tour(ids: dict, portal_id: str | None, ui_domain: str) -> Path:
    """Record the HubSpot UI walkthrough of the fixture. Returns mp4 path."""
    from playwright.async_api import async_playwright

    if not STATE_FILE.exists():
        raise SystemExit(
            "No saved HubSpot session. Run first:  "
            "cd scripts && uv run python capture-hubspot.py --login"
        )

    video_dir = SCRIPTS_DIR / ".video-cache"
    shutil.rmtree(video_dir, ignore_errors=True)
    video_dir.mkdir(parents=True)

    init_script = (
        PORTAL_MASK_INIT_SCRIPT_TEMPLATE % json.dumps(portal_id) if portal_id else None
    )

    # URLs don't include the portal in the PATH for modern HubSpot — the
    # portal ID surfaces as a /contacts/<id>/ segment, which we mask via
    # the init script anyway. Viewport-only video excludes the address bar.
    company_url = (
        f"https://{ui_domain}/contacts/{portal_id}/record/0-2/{ids['company_id']}"
        if portal_id
        else f"https://{ui_domain}/"
    )
    deal_url = (
        f"https://{ui_domain}/contacts/{portal_id}/record/0-3/{ids['deal_id']}"
        if portal_id
        else f"https://{ui_domain}/"
    )

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            storage_state=str(STATE_FILE),
            record_video_dir=str(video_dir),
            record_video_size={"width": 1400, "height": 860},
            viewport={"width": 1400, "height": 860},
        )
        if init_script:
            await context.add_init_script(init_script)
        page = await context.new_page()

        log("pw", f"open company: {company_url}")
        await page.goto(company_url, wait_until="domcontentloaded", timeout=60_000)
        # Wait for the company name to render (proof the UI actually loaded)
        try:
            await page.wait_for_selector(f"text={COMPANY_NAME}", timeout=30_000)
            log("pw", "company record rendered")
        except Exception:  # noqa: BLE001
            log("pw", "company selector timeout — proceeding anyway")
        await page.wait_for_timeout(4_000)

        # Scroll down to show associated contacts + deal
        await page.mouse.wheel(0, 600)
        await page.wait_for_timeout(3_000)
        await page.mouse.wheel(0, 600)
        await page.wait_for_timeout(3_000)

        log("pw", f"open deal: {deal_url}")
        await page.goto(deal_url, wait_until="domcontentloaded", timeout=60_000)
        try:
            await page.wait_for_selector(f"text={DEAL_NAME}", timeout=30_000)
            log("pw", "deal record rendered")
        except Exception:  # noqa: BLE001
            log("pw", "deal selector timeout — proceeding anyway")
        await page.wait_for_timeout(5_000)

        await context.close()
        await browser.close()

    mp4s = list(video_dir.glob("*.webm")) + list(video_dir.glob("*.mp4"))
    if not mp4s:
        raise RuntimeError("Playwright produced no video")
    return mp4s[0]


def convert_to_gif(src: Path, dest_gif: Path, dest_mp4: Path) -> None:
    """Convert Playwright's webm to a Catppuccin-friendly .gif + .mp4."""
    dest_gif.parent.mkdir(parents=True, exist_ok=True)

    # MP4 (H.264, web-playable)
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

    # GIF — palette-based + conservative fps/scale so the README stays light.
    # 8 fps is enough to read a page walkthrough (no fast motion); 900px
    # width is still readable for side-by-side panels.
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
            "-lavfi", "fps=8,scale=900:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5",
            str(dest_gif),
        ],
        check=True,
    )
    palette.unlink(missing_ok=True)


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("--login", action="store_true",
                        help="One-time headed login to save scripts/.hubspot-state.json")
    parser.add_argument("--keep", action="store_true",
                        help="Don't archive the fixture after capture (for debugging)")
    args = parser.parse_args()

    if args.login:
        return await do_login()

    portal_id = fetch_portal_id()
    ui_domain = fetch_ui_domain()
    if not portal_id:
        log("warn", "could not resolve portal ID — UI masking will be skipped")

    ids = hscli_create_fixture()
    log("demo", f"fixture ready: {ids}")

    try:
        src_video = await capture_tour(ids, portal_id, ui_domain)
        log("demo", f"captured video: {src_video}")
        convert_to_gif(
            src_video,
            DOCS_DIR / "demo-hubspot.gif",
            DOCS_DIR / "demo-hubspot.mp4",
        )
        log("demo", f"wrote {DOCS_DIR / 'demo-hubspot.gif'}")
    finally:
        if args.keep:
            log("demo", f"--keep: leaving fixture in portal: {ids}")
        else:
            log("demo", "archiving fixture")
            hscli_archive_fixture(ids)

    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
