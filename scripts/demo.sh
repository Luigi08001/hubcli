#!/usr/bin/env bash
#
# hscli terminal demo — "blank → full CRUD + associations → blank".
#
# Every run, on an already-authed HubSpot portal:
#   1. Identifies the portal (masks the numeric portal ID)
#   2. CREATES   — 1 company + 2 exec contacts + 1 deal (unique namespace)
#   3. ASSOCIATES — both contacts ↔ company, deal ↔ company
#   4. READS     — fetches the company with its associations
#   5. UPDATES   — closes the deal, bumps amount, moves contact to customer
#   6. ARCHIVES  — tears everything down
#   7. Summary   — portal back to its prior state
#
# Safe to re-run: each invocation uses a fresh timestamp namespace and a
# `trap` archives everything on abort.
#
# Used by scripts/demo.tape to produce docs/demo-terminal.gif.
#
set -euo pipefail

BOLD=$'\e[1m'; DIM=$'\e[2m'; CYAN=$'\e[36m'; GREEN=$'\e[32m'; RED=$'\e[31m'; RESET=$'\e[0m'
hdr() { printf "\n${BOLD}${CYAN}━━━ %s ━━━${RESET}\n" "$1"; }
cmd() { printf "${DIM}$ ${RESET}${BOLD}%s${RESET}\n" "$*"; }
note() { printf "${DIM}# %s${RESET}\n" "$*"; }
ok()  { printf "${GREEN}✓${RESET} %s\n" "$*"; }
bad() { printf "${RED}✗${RESET} %s\n" "$*"; }

TS=$(date +%s)
NS="demo-${TS}"

# Realistic fake-data fixtures — a plausible B2B customer scenario.
# Using the .dev TLD (hscli's own namespace) so emails are clearly fake
# but pass HubSpot's format validation.
COMPANY_NAME="Northwind Trading Co"
COMPANY_DOMAIN="${NS}.northwind-trading.hscli.dev"
DEAL_NAME="Northwind — Enterprise Renewal 2026"

EMAIL_VP="elena.rodriguez+${NS}@hscli.dev"
EMAIL_OPS="marcus.chen+${NS}@hscli.dev"

declare -a CONTACT_IDS=()
COMPANY_ID=""
DEAL_ID=""

cleanup() {
  for id in "${CONTACT_IDS[@]}"; do
    hscli --force --json crm contacts delete "$id" >/dev/null 2>&1 || true
  done
  [[ -n "$COMPANY_ID" ]] && hscli --force --json crm companies delete "$COMPANY_ID" >/dev/null 2>&1 || true
  [[ -n "$DEAL_ID" ]] && hscli --force --json crm deals delete "$DEAL_ID" >/dev/null 2>&1 || true
}
trap cleanup ERR INT

# ═════════════════════════════════════════════════════════════════════════
# 1. IDENTITY — portal ID is masked intentionally
# ═════════════════════════════════════════════════════════════════════════
hdr "1. Target portal"
cmd "hscli --json account info | jq '{accountType, dataHostingLocation, uiDomain, timeZone}'"
# Deliberately omits portalId — redacted for public demos.
hscli --json account info | jq '.data | {accountType, dataHostingLocation, uiDomain, timeZone}'
sleep 1

# ═════════════════════════════════════════════════════════════════════════
# 2. CREATE — company + 2 contacts + 1 deal
# ═════════════════════════════════════════════════════════════════════════
hdr "2. CREATE — 1 company · 2 contacts · 1 deal"

note "Writes without --force are blocked at the CLI level"
cmd "hscli crm companies create --data '{\"properties\":{\"name\":\"...\"}}'"
hscli crm companies create --data "{\"properties\":{\"name\":\"${COMPANY_NAME}\"}}" 2>&1 | head -1 || true
sleep 1

note "With --force: real writes, idempotency-keyed, capability-checked"

cmd "hscli --force --json crm companies create  # Northwind Trading Co"
R1=$(hscli --force --json crm companies create --data "{\"properties\":{\"name\":\"${COMPANY_NAME}\",\"domain\":\"${COMPANY_DOMAIN}\",\"industry\":\"COMPUTER_SOFTWARE\",\"numberofemployees\":\"420\",\"annualrevenue\":\"48000000\"}}")
COMPANY_ID=$(echo "$R1" | jq -r '.data.id')
ok "company ${COMPANY_ID} · ${COMPANY_NAME}"

cmd "hscli --force --json crm contacts create  # Elena Rodriguez · VP Sales"
R2=$(hscli --force --json crm contacts create --data "{\"properties\":{\"email\":\"${EMAIL_VP}\",\"firstname\":\"Elena\",\"lastname\":\"Rodriguez\",\"jobtitle\":\"VP of Sales\",\"phone\":\"+1-415-555-0182\"}}")
CONTACT_IDS+=("$(echo "$R2" | jq -r '.data.id')")
ok "contact ${CONTACT_IDS[0]} · Elena Rodriguez · VP of Sales"

cmd "hscli --force --json crm contacts create  # Marcus Chen · Director of Ops"
R3=$(hscli --force --json crm contacts create --data "{\"properties\":{\"email\":\"${EMAIL_OPS}\",\"firstname\":\"Marcus\",\"lastname\":\"Chen\",\"jobtitle\":\"Director of Operations\",\"phone\":\"+1-415-555-0147\"}}")
CONTACT_IDS+=("$(echo "$R3" | jq -r '.data.id')")
ok "contact ${CONTACT_IDS[1]} · Marcus Chen · Director of Operations"

cmd "hscli --force --json crm deals create  # Enterprise Renewal 2026"
R4=$(hscli --force --json crm deals create --data "{\"properties\":{\"dealname\":\"${DEAL_NAME}\",\"amount\":\"125000\",\"dealstage\":\"qualifiedtobuy\",\"pipeline\":\"default\",\"closedate\":\"2026-09-30\"}}")
DEAL_ID=$(echo "$R4" | jq -r '.data.id')
ok "deal ${DEAL_ID} · ${DEAL_NAME} · \$125,000"
sleep 2

# ═════════════════════════════════════════════════════════════════════════
# 3. ASSOCIATE — wire contacts + deal to company, and contacts to deal
# ═════════════════════════════════════════════════════════════════════════
hdr "3. ASSOCIATE — contacts ↔ company · deal ↔ company · contacts ↔ deal"

cmd "hscli --force crm associations create contacts ${CONTACT_IDS[0]} companies ${COMPANY_ID}"
hscli --force --json crm associations create contacts "${CONTACT_IDS[0]}" companies "${COMPANY_ID}" >/dev/null
ok "Elena ↔ Northwind Trading"

cmd "hscli --force crm associations create contacts ${CONTACT_IDS[1]} companies ${COMPANY_ID}"
hscli --force --json crm associations create contacts "${CONTACT_IDS[1]}" companies "${COMPANY_ID}" >/dev/null
ok "Marcus ↔ Northwind Trading"

cmd "hscli --force crm associations create deals ${DEAL_ID} companies ${COMPANY_ID}"
hscli --force --json crm associations create deals "${DEAL_ID}" companies "${COMPANY_ID}" >/dev/null
ok "deal ↔ Northwind Trading"

cmd "hscli --force crm associations create contacts ${CONTACT_IDS[0]} deals ${DEAL_ID}"
hscli --force --json crm associations create contacts "${CONTACT_IDS[0]}" deals "${DEAL_ID}" >/dev/null
ok "Elena ↔ deal (primary contact)"

cmd "hscli --force crm associations create contacts ${CONTACT_IDS[1]} deals ${DEAL_ID}"
hscli --force --json crm associations create contacts "${CONTACT_IDS[1]}" deals "${DEAL_ID}" >/dev/null
ok "Marcus ↔ deal"
sleep 2

# ═════════════════════════════════════════════════════════════════════════
# 4. READ — fetch the company + its associations (deterministic, by ID)
# ═════════════════════════════════════════════════════════════════════════
hdr "4. READ — company + associations"

cmd "hscli --json crm companies get ${COMPANY_ID} --properties name,domain,numberofemployees,annualrevenue"
hscli --json crm companies get "$COMPANY_ID" --properties name,domain,numberofemployees,annualrevenue 2>/dev/null \
  | jq '.data | {id, name: .properties.name, domain: .properties.domain, employees: .properties.numberofemployees, revenue: .properties.annualrevenue}'

cmd "hscli --json crm associations list contacts ${CONTACT_IDS[0]} companies"
hscli --json crm associations list contacts "${CONTACT_IDS[0]}" companies 2>/dev/null \
  | jq '.data | {from: "contact Elena", associated_companies: [.results[].toObjectId]}'
sleep 2

# ═════════════════════════════════════════════════════════════════════════
# 5. UPDATE — close the deal, promote the contact to customer
# ═════════════════════════════════════════════════════════════════════════
hdr "5. UPDATE — close the deal, promote Elena to customer"

cmd "hscli --force --json crm deals update ${DEAL_ID} --data '{... amount: 142000, dealstage: closedwon}'"
hscli --force --json crm deals update "$DEAL_ID" --data '{"properties":{"amount":"142000","dealstage":"closedwon"}}' \
  | jq '.data | {id, amount: .properties.amount, dealstage: .properties.dealstage}'
ok "deal → \$142,000 · closedwon"

cmd "hscli --force --json crm contacts update ${CONTACT_IDS[0]} --data '{... lifecyclestage: customer}'"
hscli --force --json crm contacts update "${CONTACT_IDS[0]}" --data '{"properties":{"lifecyclestage":"customer"}}' \
  | jq '.data | {id, lifecyclestage: .properties.lifecyclestage, updatedAt}'
ok "Elena → lifecyclestage: customer"
sleep 2

# ═════════════════════════════════════════════════════════════════════════
# 6. ARCHIVE — clean teardown
# ═════════════════════════════════════════════════════════════════════════
hdr "6. ARCHIVE — tear it all down"

cmd "hscli --force --json crm deals delete ${DEAL_ID}"
hscli --force --json crm deals delete "$DEAL_ID" | jq '.data'
ok "deal archived"

for id in "${CONTACT_IDS[@]}"; do
  cmd "hscli --force --json crm contacts delete ${id}"
  hscli --force --json crm contacts delete "$id" | jq '.data'
done
ok "2 contacts archived"

cmd "hscli --force --json crm companies delete ${COMPANY_ID}"
hscli --force --json crm companies delete "$COMPANY_ID" | jq '.data'
ok "company archived"

declare -a DELETED_CONTACT_IDS=("${CONTACT_IDS[@]}")
CONTACT_IDS=()
COMPANY_ID=""
DEAL_ID=""
sleep 1

# ═════════════════════════════════════════════════════════════════════════
# 7. SUMMARY
# ═════════════════════════════════════════════════════════════════════════
hdr "7. Summary"
ok "1 company · ${#DELETED_CONTACT_IDS[@]} contacts · 1 deal · 5 associations"
ok "created · associated · read · updated · archived"
ok "portal back to prior state · namespace ${NS} is empty"

printf "\n${BOLD}${GREEN}Blank → full CRUD + associations → blank, on a live HubSpot portal.${RESET}\n"
printf "${DIM}  npm install -g @revfleet/hscli${RESET}\n"
