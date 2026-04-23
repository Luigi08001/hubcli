"""
Record a LIVE walkthrough of hscli creating HubSpot *assets* (not records).

Sibling of capture-hubspot.py — same interleaved CLI ↔ UI reload pattern,
but targeting marketing/automation primitives instead of CRM records:

  1. Landing pages index opens — asset list visible.
  2. hscli creates a landing page → reload → page appears in the list.
  3. Marketing emails index opens.
  4. hscli creates a marketing email → reload → email appears.
  5. Workflows index opens.
  6. hscli creates a workflow flow → reload → workflow appears.
  7. Teardown: hscli DELETEs all three via `api request --method DELETE`.

Narration banner + portal-ID DOM mask are identical to the records tour.

Prereqs (same storageState as capture-hubspot.py):
  - `uv run python capture-hubspot.py --login`  ← one-time headed login
  - Then: `uv run python capture-hubspot-assets.py`

Output: docs/demo-hubspot-assets.{gif,mp4}
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

# Resolve hscli — prefer a globally-installed `hscli` (matches what
# end users see in the demo narration), fall back to `node dist/cli.js`
# from the repo so CI / sandboxed contexts without a global install
# still work.
def _resolve_hscli_cmd() -> list[str]:
    globally = shutil.which("hscli")
    if globally:
        return [globally]
    local = SCRIPTS_DIR.parent / "dist" / "cli.js"
    if not local.exists():
        raise SystemExit(
            "No hscli found. Install globally (npm i -g @revfleet/hscli) "
            "or build locally (cd .. && npm run build)."
        )
    return ["node", str(local)]


HSCLI_CMD = _resolve_hscli_cmd()

TS = int(time.time())
NS = f"demo-{TS}"

LP_NAME = f"hscli-demo-{NS}"
LP_SLUG = f"hscli-demo-{NS}"
EMAIL_NAME = f"hscli Welcome · {NS}"
EMAIL_SUBJECT = "Welcome to Northwind Trading"
WORKFLOW_NAME = f"hscli onboarding · {NS}"


def log(stage: str, msg: str) -> None:
    ts = time.strftime("%H:%M:%S")
    print(f"[{ts}] {stage:7}  {msg}", flush=True)


def hscli(*args: str, data: dict | None = None) -> dict:
    cmd = [*HSCLI_CMD, "--force", "--json", *args]
    if data is not None:
        cmd += ["--data", json.dumps(data)]
    out = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=60)
    payload = json.loads(out.stdout)
    if not payload.get("ok"):
        raise RuntimeError(f"hscli failed: {payload}")
    return payload["data"]


def hscli_silent(*args: str) -> None:
    subprocess.run(
        [*HSCLI_CMD, "--force", "--json", *args],
        capture_output=True, text=True, check=False, timeout=60,
    )


def create_landing_page() -> str:
    # Rich payload: templatePath + populated htmlTitle/metaDescription,
    # a `hero` layoutSection, and a `headline` widget with a real
    # H1/CTA. HubSpot's editor renders this immediately — no "select a
    # template" modal blocking the view.
    return hscli(
        "marketing", "landing-pages", "create",
        data={
            "name": LP_NAME,
            "slug": LP_SLUG,
            "language": "en",
            "htmlTitle": "Northwind · Early Access · Get the kit",
            "metaDescription": (
                "Join the Northwind Trading early access program — "
                "60 seconds to claim your slot."
            ),
            "state": "DRAFT",
            "templatePath": "@hubspot/growth/templates/homepage.html",
            "layoutSections": {
                "hero": {"name": "hero", "type": "section", "cells": []},
            },
            "widgets": {
                "headline": {
                    "body": {
                        "value": (
                            "<h1>Get 60 seconds back on every contact update.</h1>"
                            "<p>The Northwind Early Access kit: deploy in one "
                            "command, measured with a full audit trail.</p>"
                            "<a href=\"#signup\" style=\"background:#22D3EE;"
                            "color:#0F172A;padding:12px 28px;border-radius:8px;"
                            "text-decoration:none;font-weight:600\">"
                            "Claim your slot →</a>"
                        )
                    }
                }
            },
        },
    )["id"]


def upload_hero_image() -> tuple[str, str]:
    """Upload the Northwind hero banner via the new 0.8.4
    `hscli marketing emails upload-image` command. Returns
    (file_id, hubfs_url) so the scene can narrate the upload
    separately and the teardown can archive the uploaded file."""
    resp = hscli(
        "marketing", "emails", "upload-image",
        "--url", "https://placehold.co/1200x240/0F172A/F8FAFC/png?text=NORTHWIND+TRADING",
        "--filename", f"northwind-hero-{NS}.png",
        "--folder", "/Images",
    )
    return str(resp.get("fileId") or ""), str(resp.get("url") or "")


def create_email(hero_img_url: str) -> str:
    # Production-quality AUTOMATED_DRAFT email built by composing
    # HubSpot's drag-and-drop library modules into a flexArea layout
    # of 8 sections. Each section holds one module; HubSpot's canvas
    # renders them top-to-bottom with the padding we specify.
    #
    # What unlocked body rendering:
    #   1. `state: "AUTOMATED_DRAFT"` — the regular DRAFT state
    #      silently falls back to the template's placeholder text on
    #      thumbnail generation. AUTOMATED_DRAFT uses the automation
    #      rendering path, which reads the stored widget HTML.
    #   2. Full widget metadata — `css_class: "dnd-module"`, `path`,
    #      `schema_version: 2`, `lineNumber`, `startPosition`,
    #      `parent_widget_container: null`. A minimal shape persists
    #      in the DB but doesn't render.
    #   3. `preview_text` as its own widget (top-level `previewText`
    #      is silently dropped).
    #   4. `styleSettings` — email body chrome (background, fonts,
    #      link color).
    #   5. `flexAreas.main.sections` — the canvas layout grid. Each
    #      section has columns[] → widgets[] referencing widget IDs.
    #
    # Module library access:
    #   - GET /cms/v3/source-code/published/content/@hubspot/{module}.module/fields.json
    #     returns every module's full field schema. Probed a dozen
    #     and only `@hubspot/rich_text` + `@hubspot/email_footer`
    #     + the preview_text widget render in the email canvas —
    #     @hubspot/button, /divider, /header are page-only modules
    #     and silently no-op in emails. The CTA button is done as
    #     inline-HTML inside a rich_text module (bulletproof <table>
    #     pattern for Outlook + dark mode).
    #
    # module_id 1155639 = built-in rich_text.
    # module_id 2869621 = built-in email_footer.

    def section(idx, wids, pt=0, pb=0):
        return {
            "id": f"section-{idx}", "path": None,
            "columns": [{"id": f"column-{idx}-0", "widgets": wids, "width": 12}],
            "style": {
                "backgroundColor": "", "backgroundImage": None,
                "backgroundImageType": None, "backgroundType": "CONTENT",
                "breakpointStyles": {
                    "default": {"backgroundColor": "", "backgroundImage": None,
                                "backgroundImageType": None, "backgroundType": "CONTENT",
                                "hidden": None, "paddingBottom": f"{pb}px",
                                "paddingTop": f"{pt}px", "verticalAlign": None},
                    "mobile":  {"backgroundColor": "", "backgroundImage": None,
                                "backgroundImageType": None, "backgroundType": "CONTENT",
                                "hidden": None, "paddingBottom": f"{pb}px",
                                "paddingTop": f"{pt}px", "verticalAlign": None},
                },
                "paddingBottom": f"{pb}px", "paddingTop": f"{pt}px",
                "stack": "LEFT_TO_RIGHT",
            },
        }

    def rt_module(wid, order, html):
        return {
            "type": "module", "name": wid, "id": wid,
            "module_id": 1155639, "order": order,
            "label": None, "css": {}, "child_css": {}, "smart_type": None,
            "styles": {"breakpointStyles": {"default": {}, "mobile": {}}},
            "body": {
                "css_class": "dnd-module", "path": "@hubspot/rich_text",
                "schema_version": 2, "lineNumber": 32, "startPosition": 19,
                "parent_widget_container": None, "html": html,
            },
        }

    cta_html = (
        '<table role="presentation" cellspacing="0" cellpadding="0" '
        'border="0" style="margin:0 auto;border-collapse:separate">'
        '<tr><td style="border-radius:10px;background:#0F172A">'
        '<a href="https://northwind.example.com/kit" '
        'style="display:inline-block;padding:14px 32px;font-weight:600;'
        'color:#F8FAFC;text-decoration:none;font-size:15px;'
        'border-radius:10px;background:#0F172A;line-height:1.2">'
        'Get your onboarding kit &nbsp;→</a></td></tr></table>'
    )

    # Hero image comes from `upload_hero_image()` — caller passes
    # the HubFS CDN URL so the upload step can be narrated as its own
    # scene beat.
    hero_html = (
        f'<p style="text-align:center;margin:0">'
        f'<img src="{hero_img_url}" alt="Northwind Trading" '
        f'width="600" style="max-width:600px;height:auto;'
        f'display:block;margin:0 auto;border-radius:8px"></p>'
    )

    widgets = {
        "preview_text": {
            "type": "text", "name": "preview_text", "id": "preview_text",
            "order": 0,
            "body": {"value": "Your onboarding kit + a 90-second primer for week one."},
        },
        # Hero banner image (renders only in webversion preview)
        "module-hero": rt_module("module-hero", 1, hero_html),
        "module-0-0-0": rt_module("module-0-0-0", 2,
            '<h1 style="font-size:28px;font-weight:700;color:#0F172A;'
            'margin:0 0 8px;line-height:1.2">Welcome aboard 👋</h1>'
            '<p style="color:#64748B;font-size:15px;margin:0;line-height:1.5">'
            "You just joined Northwind Trading. Here's what happens next.</p>"),
        "module-1-0-0": rt_module("module-1-0-0", 3,
            '<p style="line-height:1.6;color:#0F172A;font-size:15px;margin:0">'
            "Your onboarding concierge is <strong>Marcus Chen</strong>. "
            "He'll reach out within 24 hours with your personalized kickoff "
            "plan — account setup, team seating, success metrics.</p>"),
        "module-2-0-0": rt_module("module-2-0-0", 4, cta_html),
        "module-3-0-0": rt_module("module-3-0-0", 5,
            '<p style="margin:0 0 8px;color:#64748B;font-size:14px">'
            "Or jump straight to:</p>"
            '<ul style="padding-left:20px;margin:0;color:#0F172A;font-size:14px">'
            '<li><a href="https://northwind.example.com/docs" style="color:#0891B2">API quickstart</a> — 5 min read</li>'
            '<li><a href="https://northwind.example.com/community" style="color:#0891B2">Community Slack</a> — 8,000+ members</li>'
            '<li><a href="https://northwind.example.com/status" style="color:#0891B2">Status page</a> — uptime + incidents</li>'
            "</ul>"),
        "module-4-0-0": rt_module("module-4-0-0", 6,
            '<hr style="border:none;border-top:1px solid #E2E8F0;margin:0">'),
        "module-5-0-0": rt_module("module-5-0-0", 7,
            '<p style="margin:0;font-size:14px;color:#64748B;line-height:1.5">'
            "See you inside,<br>"
            '<strong style="color:#0F172A">Elena Rodriguez</strong><br>'
            "VP of Customer Success · Northwind Trading</p>"),
        "module-6-0-0": {
            "type": "module", "name": "module-6-0-0", "id": "module-6-0-0",
            "module_id": 2869621, "order": 8,
            "label": None, "css": {}, "child_css": {}, "smart_type": None,
            "styles": {"breakpointStyles": {"default": {}, "mobile": {}}},
            "body": {
                "css_class": "dnd-module", "path": "@hubspot/email_footer",
                "schema_version": 2, "lineNumber": 61, "startPosition": -973,
                "parent_widget_container": None, "align": "center",
                "unsubscribe_link_type": "both",
            },
        },
    }

    flex_areas = {"main": {
        "boxFirstElementIndex": None, "boxLastElementIndex": None,
        "boxed": False, "isSingleColumnFullWidth": False,
        "sections": [
            section(0, ["module-hero"],  20, 20),  # hero banner image
            section(1, ["module-0-0-0"], 8,  4),   # heading
            section(2, ["module-1-0-0"], 0,  24),  # body
            section(3, ["module-2-0-0"], 8,  24),  # CTA
            section(4, ["module-3-0-0"], 0,  24),  # links
            section(5, ["module-4-0-0"], 8,  16),  # divider
            section(6, ["module-5-0-0"], 0,  32),  # signature
            section(7, ["module-6-0-0"], 0,  0),   # footer
        ],
    }}

    return hscli(
        "marketing", "emails", "create",
        data={
            "name": EMAIL_NAME,
            "subject": "Welcome to Northwind Trading",
            "state": "AUTOMATED_DRAFT",
            "from": {
                "fromName": "Elena Rodriguez · Northwind",
                "fromEmail": "elena@hscli.dev",
                "replyTo": "elena@hscli.dev",
            },
            "emailTemplateMode": "DRAG_AND_DROP",
            "content": {
                "templatePath": "@hubspot/email/dnd/plain_text.html",
                "styleSettings": {
                    "backgroundColor": "#F8FAFC", "bodyColor": "#FFFFFF",
                    "bodyBorderWidth": 0,
                    "primaryFont": "Inter, Arial, sans-serif",
                    "primaryFontColor": "#0F172A", "primaryFontSize": 15,
                    "headingOneFont": {"size": 28}, "headingTwoFont": {"size": 20},
                    "linksFont": {"color": "#0891B2", "underline": False,
                                   "bold": False, "italic": False},
                    "buttonStyleSettings": {"backgroundColor": "#0F172A",
                                             "cornerRadius": 10},
                },
                "flexAreas": flex_areas,
                "widgets": widgets,
            },
        },
    )["id"]


def create_workflow() -> str:
    # Rich payload: a real LIST_BASED enrollment filter (contacts
    # where lifecyclestage IS lead). Replaces the previous MANUAL
    # trigger — the canvas then shows "When lifecycle stage is Lead"
    # instead of "Manually triggered only".
    #
    # Actions array is intentionally empty — HubSpot's v4 flow action
    # schema (actionTypeIds, fields, connections) is fragile and
    # returns 500s on minor payload mismatches, so we stick to a
    # verified working trigger and leave the canvas at: trigger →
    # empty → End. A follow-up task can populate real action nodes.
    return hscli(
        "workflows", "flows", "create",
        data={
            "name": WORKFLOW_NAME,
            "type": "CONTACT_FLOW",
            "flowType": "WORKFLOW",
            "objectTypeId": "0-1",
            "isEnabled": False,
            "enrollmentCriteria": {
                "type": "LIST_BASED",
                "shouldReEnroll": True,
                "listFilterBranch": {
                    "filterBranchType": "AND",
                    "filterBranchOperator": "AND",
                    "filterBranches": [],
                    "filters": [{
                        "filterType": "PROPERTY",
                        "property": "lifecyclestage",
                        "operation": {
                            "operationType": "ENUMERATION",
                            "operator": "IS_ANY_OF",
                            "values": ["lead"],
                            "includeObjectsWithNoValueSet": False,
                        },
                    }],
                },
            },
        },
    )["id"]


def archive_asset(kind: str, asset_id: str) -> None:
    path = {
        "lp": f"/cms/v3/pages/landing-pages/{asset_id}",
        "email": f"/marketing/v3/emails/{asset_id}",
        "flow": f"/automation/v4/flows/{asset_id}",
        "file": f"/files/v3/files/{asset_id}",
    }[kind]
    hscli_silent("api", "request", "--path", path, "--method", "DELETE")


def archive_all(ids: dict) -> None:
    for kind in ("flow", "email", "lp", "file"):
        if ids.get(kind):
            archive_asset(kind, ids[kind])
            ids[kind] = None


def fetch_portal_id() -> str | None:
    try:
        out = subprocess.run(
            [*HSCLI_CMD, "--json", "account", "info"],
            capture_output=True, text=True, check=True, timeout=30,
        )
        pid = json.loads(out.stdout).get("data", {}).get("portalId")
        return str(pid) if pid else None
    except Exception:  # noqa: BLE001
        return None


def fetch_ui_domain() -> str:
    try:
        out = subprocess.run(
            [*HSCLI_CMD, "--json", "account", "info"],
            capture_output=True, text=True, check=True, timeout=30,
        )
        return json.loads(out.stdout)["data"]["uiDomain"]
    except Exception:  # noqa: BLE001
        return "app.hubspot.com"


# ───────────────────────────────────────────────────────────────────────────
# Playwright — init script (portal-ID mask + narration banner)
# ───────────────────────────────────────────────────────────────────────────


def build_init_script(portal_id: str | None) -> str:
    mask_js = ""
    if portal_id:
        mask_js = (
            f"const portalRe = new RegExp({json.dumps(portal_id)}, 'g');"
            f"const mask = '\\u2022'.repeat({len(portal_id)});"
            + """
            const scrub = (node) => {
              if (!node) return;
              const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
              let n;
              while ((n = walker.nextNode())) {
                if (portalRe.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(portalRe, mask);
              }
              if (node.nodeType === 1) {
                // Only mask attribute types that are user-visible.
                // URL-bearing attributes (src, href, action, srcset,
                // formaction, data-src, poster) MUST be left intact —
                // portal IDs routinely appear in HubFS CDN hostnames
                // (`{portalId}.fs1.hubspotusercontent-eu1.net/...`),
                // and masking them would turn valid URLs into broken
                // hostnames, preventing images from loading.
                const VISIBLE_ATTRS = new Set([
                  'title', 'alt', 'aria-label', 'placeholder', 'value',
                  'data-label', 'data-title',
                ]);
                for (const el of node.querySelectorAll('*')) {
                  for (const attr of el.attributes) {
                    if (!VISIBLE_ATTRS.has(attr.name)) continue;
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
              // Belt-and-suspenders: some HubSpot views hydrate URLs
              // into text nodes via React render cycles that the
              // MutationObserver sees but mis-times. Re-scrub every
              // 400 ms for the first 6 s so late-arriving portal-ID
              // strings get masked too.
              let ticks = 0;
              const iv = setInterval(() => {
                scrub(document.documentElement);
                if (++ticks > 15) clearInterval(iv);
              }, 400);
            };
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', bootScrub, { once: true });
            } else {
              bootScrub();
            }
            """
        )

    template = r"""
(() => {
  __MASK_JS__

  const bootBanner = () => {
    const text = window.localStorage.getItem('hscli_demo_banner') || '';
    if (!text) return;
    let el = document.getElementById('hscli-demo-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'hscli-demo-banner';
      el.style.cssText = [
        'position:fixed', 'bottom:40px', 'left:50%',
        'transform:translateX(-50%)', 'z-index:2147483647',
        'background:rgba(17,17,27,0.97)', 'color:#a6e3a1',
        'border:1px solid #585b70', 'border-radius:14px',
        'padding:22px 36px', 'min-width:560px', 'max-width:1000px',
        'text-align:center',
        'font-family:ui-monospace,SFMono-Regular,Menlo,monospace',
        # Disable `--` → em-dash ligatures so CLI flags render as typed
        'font-variant-ligatures:none',
        'font-feature-settings:"liga" 0,"clig" 0,"calt" 0',
        'font-size:19px', 'line-height:1.4', 'font-weight:500',
        'box-shadow:0 14px 40px rgba(0,0,0,0.6)',
        'backdrop-filter:blur(8px)',
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
"""
    return template.replace("__MASK_JS__", mask_js)


# ───────────────────────────────────────────────────────────────────────────
# Live tour
# ───────────────────────────────────────────────────────────────────────────


def lp_editor_url(ui_domain: str, portal_id: str | None, page_id: str) -> str:
    # /page-details/ is the asset-level "summary" view — shows name,
    # draft/public status, URL, campaign, promote/edit CTAs. Preferred
    # over /pages/{portal}/editor/{id}/content because the latter
    # always throws a "this page's template is missing" blocker on
    # API-created pages (the portal has no default templates we can
    # attach without uploading one first).
    return (
        f"https://{ui_domain}/page-details/{portal_id}/landing-page/{page_id}/performance"
        if portal_id else f"https://{ui_domain}/"
    )


def email_details_url(ui_domain: str, portal_id: str | None, email_id: str) -> str:
    # /edit/{id}/content lands on the actual email editor — the reader
    # sees the real rendered body (H1, concierge paragraph, dark CTA
    # button, secondary links, signature) immediately, plus the
    # From / Subject / Preview text header. More convincing than the
    # /details/ summary which relies on a slow-to-render thumbnail
    # iframe.
    return (
        f"https://{ui_domain}/email/{portal_id}/edit/{email_id}/content"
        if portal_id else f"https://{ui_domain}/"
    )


def workflow_editor_url(ui_domain: str, portal_id: str | None, flow_id: str) -> str:
    return (
        f"https://{ui_domain}/workflows/{portal_id}/platform/flow/{flow_id}/edit"
        if portal_id else f"https://{ui_domain}/"
    )


def hub_home_url(ui_domain: str, portal_id: str | None) -> str:
    return (
        f"https://{ui_domain}/home-beta?portalId={portal_id}"
        if portal_id else f"https://{ui_domain}/"
    )


async def assert_not_signed_out(page) -> None:
    """Playwright's storageState can expire silently — HubSpot will
    happily redirect to app.hubspot.com/login or id.hubspot.com with
    an email prefill, which leaks PII into the recording. Detect
    that up-front and bail before filming anything."""
    current = page.url or ""
    if (
        "/login" in current
        or "id.hubspot.com" in current
        or "/signin" in current
    ):
        raise SystemExit(
            "HubSpot session expired — storageState cookies no longer valid.\n"
            "Re-run:  cd scripts && uv run python capture-hubspot.py --login"
        )


async def capture_asset_tour(portal_id: str | None, ui_domain: str) -> tuple[Path, dict]:
    from playwright.async_api import async_playwright

    if not STATE_FILE.exists():
        raise SystemExit(
            "No saved HubSpot session. Run first:  "
            "cd scripts && uv run python capture-hubspot.py --login"
        )

    video_dir = SCRIPTS_DIR / ".video-cache-assets"
    shutil.rmtree(video_dir, ignore_errors=True)
    video_dir.mkdir(parents=True)

    init_script = build_init_script(portal_id)
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
            # Re-try the banner eval if the execution context is destroyed
            # mid-navigation (HubSpot's SPA does occasional silent redirects
            # on index URLs — the page.evaluate collides with them).
            banner_js = """
                (t) => {
                  window.localStorage.setItem('hscli_demo_banner', t);
                  let el = document.getElementById('hscli-demo-banner');
                  if (!el) {
                    el = document.createElement('div');
                    el.id = 'hscli-demo-banner';
                    el.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);z-index:2147483647;background:rgba(17,17,27,0.97);color:#a6e3a1;border:1px solid #585b70;border-radius:14px;padding:22px 36px;min-width:560px;max-width:1000px;text-align:center;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-ligatures:none;font-feature-settings:"liga" 0,"clig" 0,"calt" 0;font-size:19px;line-height:1.4;font-weight:500;box-shadow:0 14px 40px rgba(0,0,0,0.6);backdrop-filter:blur(8px)';
                    document.documentElement.appendChild(el);
                  }
                  el.textContent = t;
                }
                """
            for attempt in range(3):
                try:
                    await page.evaluate(banner_js, text)
                    break
                except Exception as e:  # noqa: BLE001
                    msg = str(e)
                    if "Execution context was destroyed" in msg or "Target page" in msg:
                        await page.wait_for_timeout(900)
                        continue
                    raise
            await page.wait_for_timeout(hold_ms)

        async def wait_settled(seconds: float = 2.2) -> None:
            await page.wait_for_timeout(int(seconds * 1000))

        # Hide-overlays stylesheet — HubSpot renders its trial guide,
        # onboarding tours, notification teases and the Assistant/Chatspot
        # sidebar via nav-level iframes that float over the page content.
        # They're *always* visible on a fresh portal and no single close
        # button dismisses them all. Easiest: hide them via CSS once.
        #
        # The selectors below target the iframe containers by their stable
        # id/name attributes; they don't affect the underlying app layout
        # (those iframes are absolutely-positioned siblings of the main
        # content).
        hide_overlays_css = """
            #mini-trial-guide-iframe,
            iframe[name="nav-components:mini-trial-guide"],
            #in-app-notifications-tease-iframe,
            iframe[name="nav-components:notifications-tease"],
            iframe[name="nav-components:nav-onboarding-tours"],
            iframe[name="nav-components:chatspot-sidebar"],
            iframe[title="Submit HubSpot product feedback"] {
              display: none !important;
              visibility: hidden !important;
            }
        """

        async def apply_overlay_hides() -> None:
            try:
                await page.add_style_tag(content=hide_overlays_css)
            except Exception:  # noqa: BLE001
                pass

        async def dismiss_overlays() -> None:
            """HubSpot throws onboarding modals / trial guides / 'what's new'
            popups over new editors and record pages. They occlude the exact
            content we're filming. Try a battery of close-button selectors;
            each is best-effort and short-timeout so a no-overlay page
            costs almost nothing. After selector-based attempts we also
            press Escape and re-apply the overlay-hide stylesheet (which
            gets wiped on navigation)."""
            await apply_overlay_hides()
            selectors = [
                'button[aria-label="Close"]',
                'button[aria-label="Dismiss"]',
                'button[aria-label="close"]',
                'button[data-test-id="close"]',
                'button:has-text("Remind me later")',
                'button[aria-label="Close trial guide"]',
                'button[aria-label="Close Trial Guide"]',
                '[data-test-id="UIDialog-close"]',
                '[role="dialog"] button[aria-label*="lose" i]',
            ]
            for sel in selectors:
                try:
                    el = page.locator(sel).first
                    if await el.count() and await el.is_visible(timeout=500):
                        await el.click(timeout=1500)
                        await page.wait_for_timeout(400)
                except Exception:  # noqa: BLE001
                    continue

            # Trial Guide — the side panel toggles off when you click its
            # toolbar button. It's tucked under an area the mask covers
            # anyway, but toggling closes the panel so the content below
            # is visible.
            try:
                tg = page.locator('#mini-trial-guide-button').first
                if await tg.count() and await tg.is_visible(timeout=500):
                    await tg.click(timeout=1500)
                    await page.wait_for_timeout(500)
            except Exception:  # noqa: BLE001
                pass

            # Escape — catches a handful of HubSpot's internal "what's new"
            # and feature-spotlight popovers that have no accessible close.
            # Skipped on email details: Escape appears to interrupt the
            # thumbnail preview iframe's fetch, leaving the placeholder
            # "Our website provider is having trouble loading" shown.
            is_email_details = "/email/" in (page.url or "") and "/details/" in (page.url or "")
            if not is_email_details:
                try:
                    await page.keyboard.press("Escape")
                    await page.wait_for_timeout(250)
                except Exception:  # noqa: BLE001
                    pass

        async def force_portal_scrub() -> None:
            """Belt: some HubSpot SPA views repaint the portal-ID text
            after React re-renders, outrunning the MutationObserver.
            Re-run a synchronous scrub in Python-land after settle so
            the next frame captured is guaranteed clean."""
            if not portal_id:
                return
            try:
                await page.evaluate(
                    """
                    (pid) => {
                      const re = new RegExp(pid, 'g');
                      const mask = '\u2022'.repeat(pid.length);
                      const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT, null);
                      let n;
                      while ((n = walker.nextNode())) {
                        if (re.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(re, mask);
                      }
                      // Skip URL-like attributes: masking src/href would
                      // break HubFS image URLs ({portalId}.fs1.hubspot...).
                      const VISIBLE_ATTRS = new Set([
                        'title', 'alt', 'aria-label', 'placeholder', 'value',
                        'data-label', 'data-title',
                      ]);
                      for (const el of document.querySelectorAll('*')) {
                        for (const a of Array.from(el.attributes)) {
                          if (!VISIBLE_ATTRS.has(a.name)) continue;
                          if (re.test(a.value)) el.setAttribute(a.name, a.value.replace(re, mask));
                        }
                      }
                    }
                    """,
                    portal_id,
                )
            except Exception:  # noqa: BLE001
                pass

        async def goto_with_timeout(url: str, label: str) -> None:
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
            except Exception as e:  # noqa: BLE001
                log("pw", f"goto({label}) failed: {e} — continuing")
            await wait_settled(2.2)
            await assert_not_signed_out(page)
            await dismiss_overlays()
            await page.wait_for_timeout(400)
            await force_portal_scrub()

        # Opening scene — anchor on the hub home so the first frame is
        # recognizably HubSpot (and not a white loading screen).
        await goto_with_timeout(hub_home_url(ui_domain, portal_id), "home")
        await set_banner(
            "Three marketing assets — landing page, email, workflow — all created via the CLI.",
            hold_ms=2000,
        )

        # ── Act 1: landing page ───────────────────────────────────────────
        log("act", "1. landing page — create with template + hero, open editor")
        await set_banner(
            "$ hscli --force marketing landing-pages create  → template + hero H1 + CTA",
            hold_ms=1600,
        )
        ids["lp"] = create_landing_page()
        await asyncio.sleep(1.2)
        await goto_with_timeout(
            lp_editor_url(ui_domain, portal_id, ids["lp"]), "landing-page editor",
        )
        # LP details page renders the hs-sites URL containing portal
        # ID asynchronously — scrub once more right before the
        # frame-holding banner so the portal ID is masked.
        await force_portal_scrub()
        await set_banner(
            "↳ Page summary — name, URL, draft state, campaign slot — all from one CLI call.",
            hold_ms=2600,
        )
        await force_portal_scrub()

        # ── Act 2: marketing email ────────────────────────────────────────
        # Navigate straight to the webversion preview — HubSpot's
        # in-editor iframe sandboxes cross-origin images (they never
        # render in that view), but the webversion URL renders the
        # email as a contact would see it: hero banner, body, CTA,
        # links, signature, footer — all from HubSpot's module
        # library, all stitched via flexAreas.
        log("act", "2. marketing email — upload hero, create, render webversion")
        # Scene beat 1: upload the Northwind hero image via the new
        # 0.8.4 `hscli marketing emails upload-image` command.
        await set_banner(
            "$ hscli --force marketing emails upload-image  → Northwind hero → HubFS CDN",
            hold_ms=1400,
        )
        ids["file"], hero_url = upload_hero_image()
        await asyncio.sleep(0.8)

        # Scene beat 2: create the email with the uploaded URL embedded.
        await set_banner(
            "$ hscli --force marketing emails create  → 8 sections · HubSpot modules · hero image",
            hold_ms=1600,
        )
        ids["email"] = create_email(hero_url)
        await asyncio.sleep(1.8)
        try:
            email_data = hscli("marketing", "emails", "get", ids["email"])
            preview_key = email_data.get("previewKey", "")
        except Exception:  # noqa: BLE001
            preview_key = ""
        if portal_id and preview_key:
            webversion = (
                f"https://{portal_id}.hubspotpreview-eu1.com"
                f"/_hcms/preview/email/{ids['email']}"
                f"?portalId={portal_id}&preview_key={preview_key}"
            )
            await goto_with_timeout(webversion, "email webversion")
            # Active-wait until the hero image actually renders.
            # Target the image with naturalWidth > 200 to filter out
            # HubSpot's tracking pixels (1×1 transparent images) that
            # load instantly and would otherwise satisfy a generic
            # `document.querySelector('img')` check. Poll every 500 ms
            # for up to 25 s. HubSpot's image proxy takes 10–15 s to
            # return the resized asset on cold cache.
            for _ in range(50):
                loaded = await page.evaluate(
                    "() => { const imgs = Array.from(document.querySelectorAll('img'));"
                    " return imgs.some(i => i.complete && i.naturalWidth > 200); }"
                )
                if loaded:
                    break
                await page.wait_for_timeout(500)
            await page.wait_for_timeout(800)
            await force_portal_scrub()
            await set_banner(
                "↳ Rendered email — Northwind hero, body, CTA, links, footer — production-ready.",
                hold_ms=3400,
            )
            await force_portal_scrub()
        else:
            # Fallback: editor URL if webversion can't be built
            await goto_with_timeout(
                email_details_url(ui_domain, portal_id, ids["email"]), "email editor",
            )
            await page.wait_for_timeout(3_000)
            await set_banner(
                "↳ Email created — subject, sender, body, footer wired via hscli.",
                hold_ms=2800,
            )

        # ── Act 3: workflow ───────────────────────────────────────────────
        log("act", "3. workflow — create with real enrollment trigger, open canvas")
        await set_banner(
            "$ hscli --force workflows flows create  → trigger: lifecyclestage IS Lead",
            hold_ms=1600,
        )
        ids["flow"] = create_workflow()
        await asyncio.sleep(1.5)
        await goto_with_timeout(
            workflow_editor_url(ui_domain, portal_id, ids["flow"]), "workflow canvas",
        )
        await set_banner(
            "↳ Canvas opens — real enrollment filter live, action nodes next.",
            hold_ms=2800,
        )

        # ── Act 4: teardown ───────────────────────────────────────────────
        log("act", "4. teardown — archive the three assets")
        await set_banner(
            "$ hscli --force api request --method DELETE  → tearing down the fixture",
            hold_ms=1400,
        )
        archive_asset("flow", ids["flow"])
        ids["flow"] = None
        archive_asset("email", ids["email"])
        ids["email"] = None
        archive_asset("lp", ids["lp"])
        ids["lp"] = None

        await set_banner(
            "Landing page · email · workflow — created and archived, all via hscli.",
            hold_ms=2400,
        )

        await context.close()
        await browser.close()

    videos = list(video_dir.glob("*.webm"))
    if not videos:
        raise RuntimeError("Playwright produced no video")
    return videos[0], ids


# ───────────────────────────────────────────────────────────────────────────
# Convert webm → gif + mp4
# ───────────────────────────────────────────────────────────────────────────


def _save_unmasked_reference(src: Path) -> None:
    if os.environ.get("HSCLI_DUMP_NAV_REFERENCE") != "1":
        return
    ref = Path("/tmp/hscli-nav-reference-assets.png")
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
             "-ss", "3", "-i", str(src), "-frames:v", "1",
             "-update", "1", str(ref)],
            check=True,
        )
        log("demo", f"unmasked reference frame → {ref}")
    except Exception as e:  # noqa: BLE001
        log("demo", f"reference frame dump failed (non-fatal): {e}")


def convert_to_gif(src: Path, dest_gif: Path, dest_mp4: Path) -> None:
    """Same mask geometry as capture-hubspot.py — pixel-matched against
    the HubSpot top app bar at 1400×860 viewport (nav height 44 px,
    color #293E50, mask covers x=1040..1400 to hide portal selector)."""
    dest_gif.parent.mkdir(parents=True, exist_ok=True)
    _save_unmasked_reference(src)

    mask_filter = "drawbox=x=1040:y=0:w=360:h=44:color=0x293E50:t=fill"

    subprocess.run(
        [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-i", str(src),
            "-vf", mask_filter,
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            "-crf", "23", "-preset", "medium",
            str(dest_mp4),
        ],
        check=True,
    )

    palette = dest_gif.parent / ".demo-assets-palette.png"
    subprocess.run(
        [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-i", str(src),
            "-vf", f"{mask_filter},fps=7,scale=850:-1:flags=lanczos,palettegen=max_colors=96",
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
            f"{mask_filter},fps=7,scale=850:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5",
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
    parser.add_argument("--keep", action="store_true",
                        help="Don't archive the assets after capture")
    args = parser.parse_args()

    portal_id = fetch_portal_id()
    ui_domain = fetch_ui_domain()
    if not portal_id:
        log("warn", "could not resolve portal ID — UI masking will be skipped")

    ids: dict = {}
    try:
        src_video, ids = await capture_asset_tour(portal_id, ui_domain)
        log("demo", f"captured: {src_video}")
        convert_to_gif(
            src_video,
            DOCS_DIR / "demo-hubspot-assets.gif",
            DOCS_DIR / "demo-hubspot-assets.mp4",
        )
        log("demo", f"wrote {DOCS_DIR / 'demo-hubspot-assets.gif'}")
    finally:
        if args.keep:
            log("demo", f"--keep: leaving assets in portal: {ids}")
        else:
            archive_all(ids)
            log("demo", "teardown complete")

    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
