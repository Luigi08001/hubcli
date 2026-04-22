"""
hscli + browser-use end-to-end demo.

What it proves
---------------
1. An agent can use `hscli` (CLI or MCP) to create a contact in HubSpot.
2. A browser-use agent, driving a real Chromium, independently verifies
   the contact appears in the HubSpot portal UI — proving the write
   landed on the actual portal, not just a dry-run artifact.

Target portal: 147975758 (HubSpot EU1 test).

Prereqs
-------
- Python 3.11+
- uv (https://github.com/astral-sh/uv)
- hscli >= 0.8.1 installed globally and authed against portal 147975758
  (run `hscli auth whoami` to confirm)
- One of:
    ANTHROPIC_API_KEY     (recommended — Claude does HubSpot navigation well)
    OPENAI_API_KEY
- A HubSpot account with access to portal 147975758. You'll be asked to
  sign in once in the Chromium window that browser-use launches; the
  session is reused within the run.

Run
---
    cd demo
    uv sync
    uv run python demo.py

What happens
------------
1. Stage A — hscli creates a contact.
   * Picks a unique email of the form `demo-{ts}@hscli.dev`.
   * Calls `hscli --profile default --force --json crm contacts create ...`.
   * Captures the created contact's ID and HubSpot URL.

2. Stage B — browser-use verifies in the UI.
   * Launches a non-headless Chromium.
   * Hands the agent a short natural-language task referencing the unique
     email: "Go to app-eu1.hubspot.com/contacts/147975758/..., search for
     the email, confirm the record exists."
   * Agent returns either success (with the URL it navigated to) or
     failure (with an explanation).

3. Stage C — cleanup.
   * hscli deletes (archives) the contact so the portal stays clean.
   * `--dry-run` friendly: pass `--keep` to leave the record behind.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import subprocess
import sys
import time
from pathlib import Path

PORTAL_ID = 147975758
PORTAL_CONTACTS_URL = (
    f"https://app-eu1.hubspot.com/contacts/{PORTAL_ID}/objects/0-1/views/all/list"
)


def log(stage: str, msg: str) -> None:
    """Timestamped step logger — keeps the demo readable on screen."""
    ts = time.strftime("%H:%M:%S")
    print(f"[{ts}] {stage:6}  {msg}", flush=True)


def check_prereqs() -> None:
    """Fail fast if the operator forgot something obvious."""
    missing: list[str] = []

    # LLM key
    if not os.environ.get("ANTHROPIC_API_KEY") and not os.environ.get("OPENAI_API_KEY"):
        missing.append(
            "ANTHROPIC_API_KEY (or OPENAI_API_KEY) — needed for the "
            "browser-use agent."
        )

    # hscli binary + version
    try:
        out = subprocess.run(
            ["hscli", "--version"],
            capture_output=True, text=True, check=True, timeout=10,
        )
        version = out.stdout.strip()
        log("pre", f"hscli binary: {version}")
    except FileNotFoundError:
        missing.append(
            "hscli not on PATH — run `npm install -g @revfleet/hscli`."
        )
    except subprocess.CalledProcessError as e:
        missing.append(f"hscli failed: {e.stderr.strip() or e}")

    # hscli auth
    try:
        out = subprocess.run(
            ["hscli", "--json", "auth", "whoami"],
            capture_output=True, text=True, check=True, timeout=10,
        )
        info = json.loads(out.stdout)
        portal = info.get("data", {}).get("portalId")
        if portal and str(portal) != str(PORTAL_ID):
            log("pre", f"warning: hscli default profile targets portal {portal}, "
                       f"demo expects {PORTAL_ID}. Continuing anyway.")
    except Exception as e:  # noqa: BLE001
        missing.append(
            f"hscli auth whoami failed — is the default profile authed? ({e})"
        )

    if missing:
        sys.stderr.write("Demo prerequisites missing:\n")
        for m in missing:
            sys.stderr.write(f"  - {m}\n")
        sys.exit(2)


def hscli_create_contact(email: str, first: str, last: str) -> dict:
    """Stage A — hscli CLI creates a contact. Returns the HubSpot record."""
    payload = {
        "properties": {
            "email": email,
            "firstname": first,
            "lastname": last,
            "lifecyclestage": "lead",
        }
    }
    log("hscli", f"create contact email={email}")
    res = subprocess.run(
        [
            "hscli", "--force", "--json",
            "crm", "contacts", "create",
            "--data", json.dumps(payload),
        ],
        capture_output=True, text=True, check=True, timeout=30,
    )
    envelope = json.loads(res.stdout)
    if not envelope.get("ok"):
        raise RuntimeError(f"hscli returned non-OK: {envelope}")
    data = envelope["data"]
    log("hscli", f"created id={data.get('id')} (HubSpot returned status 20x)")
    return data


def hscli_archive_contact(contact_id: str) -> None:
    """Stage C — tidy up the test record. Non-fatal on failure."""
    log("hscli", f"archive id={contact_id}")
    try:
        subprocess.run(
            ["hscli", "--force", "--json", "crm", "contacts", "delete", contact_id],
            capture_output=True, text=True, check=True, timeout=30,
        )
        log("hscli", "archived (soft-delete, restorable from HubSpot UI)")
    except subprocess.CalledProcessError as e:
        log("hscli", f"archive failed (non-fatal): {e.stderr.strip() or e}")


async def browser_verify(email: str, first: str, last: str) -> dict:
    """Stage B — non-headless Chromium + AI agent confirms the contact
    exists in the HubSpot UI. Returns the agent's structured result."""
    # Import inside the async entry point so missing deps surface with a
    # clean CLI error (check_prereqs already handles hscli, but the
    # browser-use import fails loudly if uv sync wasn't run).
    from browser_use import Agent, Browser  # type: ignore

    if os.environ.get("ANTHROPIC_API_KEY"):
        # Let browser-use pick Claude if available (best at nav tasks).
        from browser_use.llm import ChatAnthropic  # type: ignore
        llm = ChatAnthropic(model="claude-sonnet-4-5")
    elif os.environ.get("OPENAI_API_KEY"):
        from browser_use.llm import ChatOpenAI  # type: ignore
        llm = ChatOpenAI(model="gpt-4.1")
    else:  # pragma: no cover — check_prereqs already caught this
        raise RuntimeError("No LLM API key set — set ANTHROPIC_API_KEY or OPENAI_API_KEY.")

    task = f"""
Your goal is to verify a HubSpot contact exists in the portal UI.

Target portal contacts list:
  {PORTAL_CONTACTS_URL}

Steps:
1. Navigate to the portal contacts list URL above.
2. If a HubSpot login page appears, STOP and wait for the user to
   complete login in this same browser window. Once logged in,
   proceed.
3. In the contacts list, use the search box to search for:
       {email}
4. Confirm a contact with:
     - email:      {email}
     - first name: {first}
     - last name:  {last}
   appears in the results. The list may need a moment to refresh.
5. Click into the contact record to confirm you can open it.
6. Report back with:
     - success: true|false
     - contact_url: the current page URL after clicking into the record
     - observed_email: what the UI shows as the contact's email
     - notes: anything surprising

Return a JSON object shaped like:
  {{"success": true, "contact_url": "...", "observed_email": "...", "notes": "..."}}
"""

    log("bu", "launching Chromium (non-headless) …")
    async with Browser(headless=False) as browser:
        agent = Agent(task=task, llm=llm, browser=browser)
        log("bu", "agent running — sign into HubSpot in the window if prompted")
        history = await agent.run()
        final = history.final_result()
        log("bu", "agent returned")
        # The agent's final message can be a str or a dict depending on
        # model output — try JSON first, fall back to the raw string.
        if isinstance(final, str):
            try:
                return json.loads(final)
            except json.JSONDecodeError:
                return {"success": None, "raw": final}
        return final or {"success": None, "raw": "(agent returned no final_result)"}


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument(
        "--keep",
        action="store_true",
        help="Leave the contact in the portal after verification (skip archive).",
    )
    parser.add_argument(
        "--skip-browser",
        action="store_true",
        help="Only run Stage A + Stage C (hscli create + archive). Useful for "
             "smoke-testing hscli without a UI roundtrip.",
    )
    args = parser.parse_args()

    check_prereqs()

    ts = int(time.time())
    email = f"demo-{ts}@hscli.dev"
    first = "Demo"
    last = f"BrowserUse-{ts}"

    # Stage A
    contact = hscli_create_contact(email, first, last)
    contact_id = str(contact.get("id") or "")

    try:
        # Stage B
        if not args.skip_browser:
            result = await browser_verify(email, first, last)
            print()
            print("Browser-use agent final result:")
            print(json.dumps(result, indent=2, default=str))
            print()
            success = bool(result.get("success"))
            log("demo", f"end-to-end success: {success}")
        else:
            log("demo", "browser verification skipped (--skip-browser)")
            success = True
    finally:
        # Stage C
        if not args.keep and contact_id:
            hscli_archive_contact(contact_id)
        elif args.keep:
            log("demo", f"keeping contact {contact_id} (pass without --keep to archive)")

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
