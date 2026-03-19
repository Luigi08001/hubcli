# Operational Playbooks

Incident response procedures for hubcli operations.

---

## 1. Token Compromise

**Severity:** Critical

### Symptoms
- Unexpected API activity on HubSpot portal (unknown writes, bulk deletes)
- Token appears in logs, error messages, or third-party systems
- HubSpot reports suspicious API usage via email

### Diagnosis
```bash
# Check recent telemetry for unusual activity
cat ~/.hubcli/telemetry.jsonl | grep '"method":"DELETE"' | tail -20

# Check which profiles exist
hubcli auth profiles

# Inspect token scopes
hubcli auth token-info --profile <profile>
```

### Immediate Response
1. **Revoke the token** in HubSpot portal: Settings > Integrations > Private Apps > Revoke
2. **Rotate credentials**: generate a new private app token with minimum necessary scopes
3. **If vault was encrypted**: re-encrypt with a new passphrase
   ```bash
   export HUBCLI_VAULT_PASSPHRASE="new-passphrase"
   hubcli auth decrypt   # with old passphrase
   hubcli auth login --token "pat-xxx-new-token"
   hubcli auth encrypt   # with new passphrase
   ```
4. **Audit recent actions** via HubSpot audit log (Settings > Account > Audit Logs)

### Recovery
```bash
# Login with new token
hubcli auth login --token "pat-eu1-new-token" --profile production

# Verify connectivity
hubcli crm contacts list --limit 1 --profile production

# Lock to read-only while investigating
hubcli auth set-mode production read-only
```

### Prevention
- Always use encrypted vault (`hubcli auth encrypt`)
- Never pass tokens as CLI arguments in shared environments — use `--token-stdin`
- Set profiles to `read-only` by default; switch to `read-write` only when needed
- Review `HUBCLI_TELEMETRY_FILE` logs regularly

---

## 2. Rate Limit Exhaustion

**Severity:** High

### Symptoms
- `RATE_LIMIT_DAILY_EXHAUSTED` error
- `HTTP_RETRY_EXHAUSTED` after 429 responses
- Increasingly long pauses between API calls (pacing)

### Diagnosis
```bash
# Check telemetry for 429 responses
cat ~/.hubcli/telemetry.jsonl | grep '"status":429' | wc -l

# Check current rate limit state via a simple request
hubcli crm contacts list --limit 1 --telemetry-file /tmp/ratelimit-check.jsonl
cat /tmp/ratelimit-check.jsonl
```

### Mitigation
1. **Stop batch operations** immediately
2. **Wait for reset**: daily quota resets at UTC midnight
3. **Reduce batch sizes**: use `--limit 10` instead of `--limit 100`
4. **Space out requests**: add delays between sync pull runs

```bash
# Small incremental sync instead of bulk
hubcli crm sync pull contacts --limit 10 --max-pages 1

# Check if quota has recovered
hubcli crm contacts list --limit 1
```

### Prevention
- Use `--telemetry-file` to monitor API usage patterns
- Run batch operations during off-peak hours
- Set `--max-pages` limits on sync operations
- Use `--limit` to control page sizes

---

## 3. Vault Passphrase Loss

**Severity:** High

### Symptoms
- `VAULT_PASSPHRASE_REQUIRED` error on any command
- Cannot read or write auth profiles

### Diagnosis
```bash
# Confirm vault is encrypted
ls -la ~/.hubcli/auth.enc

# Check if plain auth.json exists as backup
ls -la ~/.hubcli/auth.json
```

### Recovery

**If `auth.json` backup exists:**
```bash
# Remove encrypted vault, use plain file
rm ~/.hubcli/auth.enc
# Verify access
hubcli auth profiles
# Re-encrypt with new passphrase
export HUBCLI_VAULT_PASSPHRASE="new-passphrase"
hubcli auth encrypt
```

**If no backup exists:**
```bash
# Remove encrypted vault
rm ~/.hubcli/auth.enc
# Re-authenticate with each profile
hubcli auth login --token "pat-xxx-token" --profile default
hubcli auth login --token "pat-xxx-other" --profile staging
# Re-encrypt
export HUBCLI_VAULT_PASSPHRASE="new-passphrase"
hubcli auth encrypt
```

### Prevention
- Store vault passphrase in a password manager (1Password, Bitwarden)
- For CI: store in encrypted secrets (GitHub Secrets, Vault)
- Keep a secure backup of `auth.json` before encrypting

---

## 4. API Contract Drift

**Severity:** Medium

### Symptoms
- Console warnings: `Schema validation warning: ...`
- With `HUBCLI_STRICT_SCHEMAS=1`: `SCHEMA_VALIDATION_ERROR` errors
- Unexpected response shapes or missing fields

### Diagnosis
```bash
# Enable strict mode to surface all validation failures
HUBCLI_STRICT_SCHEMAS=1 hubcli crm contacts list --limit 1

# Check HubSpot API changelog
# https://developers.hubspot.com/changelog

# Test specific endpoints
hubcli api request --method GET --path "/crm/v3/objects/contacts?limit=1" --json
```

### Mitigation
1. **Non-strict mode (default)**: warnings are logged but commands continue working
2. **Update schemas**: modify `src/core/schemas.ts` to match new API shapes
3. **Use passthrough**: all schemas use `.passthrough()` so extra fields are preserved

### Escalation
- File an issue with the exact response shape and expected schema
- Check HubSpot developer forum for known API changes
- Temporarily disable strict mode: `unset HUBCLI_STRICT_SCHEMAS`

---

## 5. Capability/Tier Mismatch

**Severity:** Medium

### Symptoms
- `ENDPOINT_NOT_AVAILABLE` error
- `CAPABILITY_UNSUPPORTED` error
- `CAPABILITY_SCOPE_MISSING` in strict mode

### Diagnosis
```bash
# Check what capabilities are available
hubcli doctor capabilities --refresh --json

# Check token scopes
hubcli auth token-info

# Test the specific endpoint directly
hubcli api request --method GET --path "/marketing/v3/emails?limit=1"
```

### Resolution
1. **Missing scopes**: create a new private app with required scopes in HubSpot
2. **Tier limitation**: upgrade HubSpot plan (e.g., Marketing Hub for email API)
3. **Use fallback**: the error message includes a fallback command
4. **Clear stale cache**:
   ```bash
   rm ~/.hubcli/capabilities.json
   hubcli doctor capabilities --refresh
   ```

---

## 6. EU1/Hublet Routing Errors

**Severity:** High

### Symptoms
- 401/403 errors on EU1 portal despite valid token
- Data from wrong portal (NA data instead of EU)
- `doctor hublet-check` reports mismatches

### Diagnosis
```bash
# Run hublet consistency check
hubcli doctor hublet-check --json

# Verify profile configuration
hubcli auth profile-show --profile default
```

### Resolution
```bash
# Re-login — hublet auto-detected from token prefix
hubcli auth login --token "pat-eu1-your-token"

# Verify routing
hubcli doctor hublet-check
# Should show: hublet=eu1, apiDomain=api-eu1.hubapi.com

# If using @hubspot/cli too, ensure ~/.hscli/config.yml has env: eu1
```

### Prevention
- Always use `pat-eu1-*` tokens for EU1 portals
- Run `hubcli doctor hublet-check` after initial setup
- Check `apiDomain` in profile: `hubcli auth profile-show`

---

## 7. Permission Profile Lockout

**Severity:** Low

### Symptoms
- `PERMISSION_DENIED` error: "Profile 'X' is configured as read-only"
- Write operations fail despite `--force`

### Diagnosis
```bash
# Check current mode
hubcli auth profile-show --profile <name>
# Look for: "mode": "read-only"
```

### Recovery
```bash
# Switch back to read-write
hubcli auth set-mode <profile> read-write

# Verify
hubcli --force crm contacts create --data '{"properties":{"email":"test@example.com"}}' --dry-run
```

### Audit
- Check who changed the mode and when (git log if config is versioned)
- Consider if read-only was set intentionally for safety

---

## 8. Rollback Procedure

**Severity:** Varies

### When to Rollback
- New version introduces breaking changes
- Plugin causes unexpected behavior
- Build artifacts are corrupted

### Steps
```bash
# Check recent commits
git log --oneline -10

# Rollback to previous known-good commit
git checkout <commit-hash>

# Rebuild
npm ci && npm run build

# Verify
npm test
hubcli crm contacts list --limit 1
```

### Post-Rollback
1. Verify all tests pass: `npm test`
2. Verify auth still works: `hubcli auth profiles`
3. Check MCP server if used: verify `.mcp.json` points to correct `dist/cli.js`
4. Document the rollback reason for post-mortem

---

## General Escalation Path

1. **Check docs**: `docs/COOKBOOK.md`, `docs/PLUGIN_GUIDE.md`
2. **Check diagnostics**: `hubcli doctor hublet-check`, `hubcli doctor capabilities --refresh`
3. **Enable telemetry**: `--telemetry-file /tmp/debug.jsonl`
4. **Enable strict mode**: `HUBCLI_STRICT_SCHEMAS=1 HUBCLI_STRICT_CAPABILITIES=1`
5. **File issue**: include error code, redacted command, and telemetry output
