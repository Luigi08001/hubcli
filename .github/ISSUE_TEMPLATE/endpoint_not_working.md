---
name: Endpoint not working
about: An endpoint that hubcli exposes returns unexpected errors on your portal
title: '[ENDPOINT] /path/to/endpoint — short description'
labels: endpoint-issue
---

## What command failed

```bash
hubcli ... # the exact command, tokens redacted
```

## HubSpot portal context

- **HubSpot plan** (check each hub):
  - Marketing Hub: `[ ] Free  [ ] Starter  [ ] Pro  [ ] Enterprise`
  - Sales Hub: `[ ] Free  [ ] Starter  [ ] Pro  [ ] Enterprise`
  - Service Hub: `[ ] Free  [ ] Starter  [ ] Pro  [ ] Enterprise`
  - CMS Hub: `[ ] None  [ ] Starter  [ ] Pro  [ ] Enterprise`
  - Operations Hub: `[ ] Free  [ ] Starter  [ ] Pro  [ ] Enterprise`
  - Commerce Hub: `[ ] None  [ ] Free  [ ] Pro`
- **Hublet region**: `[ ] US  [ ] EU1  [ ] EAP  [ ] Other: __`
- **Account type**: `[ ] Customer portal  [ ] Developer Test Account  [ ] Sandbox`
- **Token type**: `[ ] Private App  [ ] OAuth access_token from Developer App  [ ] Legacy hapikey`

## Error output

```
# Full error response including HubSpot correlationId (redact tokens)
```

## Expected per the docs/TIERS.md

<!-- Did you check docs/TIERS.md? What tier does the doc say unlocks this endpoint? -->

## Does it work in the HubSpot UI?

- [ ] The same operation works in the HubSpot UI
- [ ] It also fails in the UI (→ this is a HubSpot issue, please open with HubSpot support too)
- [ ] N/A (no UI equivalent)

## HubSpot correlation ID

<!-- Look for `correlationId` in the error response. Copy it here.
     HubSpot support can trace the request faster with this. -->

## Additional context

<!-- Anything else — is the portal new, how many records does it have, etc. -->
