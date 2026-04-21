# Tutorial: Secure agent writes with policy-as-code

**Time:** ~15 min
**Prerequisites:** `hscli` installed, a HubSpot Private App token authenticated (`hscli auth login --token-stdin`).

Agents that write to a production HubSpot portal need guardrails beyond `--force`. This tutorial walks through setting up a policy file so that an MCP-backed agent can read freely, write only to safe paths, require change tickets for risky writes, and be prevented from destructive deletes altogether.

## The problem

You've connected Claude (or any MCP client) to `hscli mcp` and want it to operate on your live HubSpot portal. Without policy:

- The agent could `POST /crm/v3/objects/contacts/gdpr-delete` with a user-provided ID and permanently delete records.
- Writes are authorised by *whether `--force` was passed*, not *what the write is*.
- There's no auditable record of *why* a particular write was allowed.

`hscli policy` fixes all three.

## Step 1 — start from a template

```bash
hscli policy templates list
```

You should see five built-in templates. For an agent that needs to create and update records but must never delete, start with `no-deletes`:

```bash
hscli policy templates extract no-deletes --to ./policy.json
```

Open `policy.json` — you'll see a `version: 2` schema with `profiles.default.rules` that allow `GET/POST/PATCH/PUT` and deny all `DELETE`.

## Step 2 — tighten for your environment

Say you want:
- Writes on CRM objects only — no CMS, no workflows.
- `gdpr-delete` and batch archive operations always blocked.
- Any write during business hours only, US/Eastern.
- Any PATCH or PUT requires a change ticket ID.

Edit `policy.json`:

```json
{
  "version": 2,
  "profiles": {
    "default": {
      "defaultAction": "deny",
      "rules": [
        {
          "name": "allow-reads",
          "match": { "method": "GET", "path": "**" },
          "action": "allow"
        },
        {
          "name": "block-gdpr-delete",
          "match": { "method": "*", "path": "**/gdpr-delete**" },
          "action": "deny"
        },
        {
          "name": "block-batch-archive",
          "match": { "method": "POST", "path": "**/batch/archive" },
          "action": "deny"
        },
        {
          "name": "allow-crm-writes-with-ticket",
          "match": { "method": "POST", "path": "/crm/v3/objects/**" },
          "action": "allow",
          "requireChangeTicket": true,
          "window": { "tz": "US/Eastern", "hours": "09-17", "days": "mon-fri" }
        },
        {
          "name": "allow-crm-updates-with-ticket",
          "match": { "method": "PATCH", "path": "/crm/v3/objects/**" },
          "action": "allow",
          "requireChangeTicket": true,
          "window": { "tz": "US/Eastern", "hours": "09-17", "days": "mon-fri" }
        }
      ]
    }
  }
}
```

Rules are evaluated **first-match-wins**, so order matters. `defaultAction: "deny"` means any method/path not explicitly matched is blocked — safe by default.

## Step 3 — validate before shipping

```bash
hscli policy validate ./policy.json
```

This parses the file and flags structural issues (invalid actions, malformed `window.hours`, rules with no `match` block that would match everything). If `valid: true`, you're good.

## Step 4 — dry-run rule matching

Before enforcing, confirm the right rule fires for the requests you expect:

```bash
hscli --policy-file ./policy.json \
  policy show-matching POST /crm/v3/objects/contacts
# → matched: allow-crm-writes-with-ticket, effectiveAction: allow

hscli --policy-file ./policy.json \
  policy show-matching DELETE /crm/v3/objects/contacts/123
# → matched: (none), effectiveAction: deny (from defaultAction)

hscli --policy-file ./policy.json \
  policy show-matching POST /crm/v3/objects/contacts/gdpr-delete
# → matched: block-gdpr-delete, effectiveAction: deny
```

## Step 5 — enforce

Either pass `--policy-file` on every invocation, or set it globally:

```bash
export HSCLI_POLICY_FILE=$PWD/policy.json
```

From now on, every `hscli` command (and every MCP tool call) runs through the policy. A denied write fails *before* the HTTP request is issued.

Try a denied operation:

```bash
hscli --force crm contacts delete 123
# → POLICY_DEFAULT_DENY: No policy rule matched DELETE /crm/v3/objects/contacts/123
#   and profile default action is 'deny'.
```

Try an allowed write without a ticket:

```bash
hscli --force crm contacts create --data '{"properties":{"email":"jane@example.com"}}'
# → POLICY_CHANGE_TICKET_REQUIRED: Policy rule 'allow-crm-writes-with-ticket'
#   requires --change-ticket for POST /crm/v3/objects/contacts.
```

With a ticket:

```bash
hscli --force --change-ticket CHG-12345 \
  crm contacts create --data '{"properties":{"email":"jane@example.com"}}'
```

## Step 6 — hook into MCP

For Claude Desktop / Cursor / any MCP client, set the env var in the server config so the policy binds to the agent's stdio server:

```json
{
  "mcpServers": {
    "hscli": {
      "command": "hscli",
      "args": ["mcp"],
      "env": {
        "HSCLI_MCP_PROFILE": "default",
        "HSCLI_POLICY_FILE": "/absolute/path/to/policy.json"
      }
    }
  }
}
```

Now every tool call the agent makes is filtered through the same rules.

## What you get

- Every write the agent attempts is auditable against a versioned policy file.
- Destructive operations (`gdpr-delete`, batch archive) are *structurally* impossible.
- Change tickets travel with the request and are written to telemetry.
- Off-hours writes are rejected — no more 2am surprises.

## Going further

- Pair this with `hscli trace start` (see the [trace tutorial](trace-replay-repro.md)) to record every request + matched rule to a JSONL file.
- Then use [`hscli audit`](audit-portal-writes.md) to answer questions like "all deletes blocked by policy last 7 days" or "which agent tried the most denied writes".
- Policy error codes (`POLICY_RULE_DENY`, `POLICY_DEFAULT_DENY`, `POLICY_CHANGE_TICKET_REQUIRED`, `POLICY_APPROVAL_REQUIRED`, `POLICY_OUT_OF_WINDOW`) are machine-readable — parse them in CI to fail builds on denied operations.
