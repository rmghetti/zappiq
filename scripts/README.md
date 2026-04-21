# ZappIQ Staging Scripts

Operational scripts for seeding, testing, and managing staging environment data.

## Scripts

### `seed-staging.ts`

**Purpose:** Create realistic staging dataset with multiple organization tiers, trial states, and conversions.

**When to use:** After fresh staging deployment or before pre-launch testing.

**What it creates:**
- 10 staging organizations across 5 plan tiers (STARTER, GROWTH, SCALE, BUSINESS, ENTERPRISE)
- 3 active trials at different readiness scores (15, 45, 72)
- 1 trial at readiness milestone 60+ (tests ReadinessMilestoneNudge)
- 2 converted GROWTH orgs + 1 SCALE + 1 BUSINESS
- 1 expired trial (unconverted)
- 1 churn-risk active account (no activity 20 days)
- 1 OWNER + 2 AGENT users per org
- 1 superadmin `rodrigo@zappiq.com.br`
- 3-5 Q&A pairs per org (vertical-specific)
- 2-3 KB documents per org
- 3 contacts + 1-2 conversations per org
- 3 months of `TenantUsageMonthly` for converted orgs

**Commands:**

```bash
# Normal seed (idempotent)
pnpm seed:staging

# Seed with reset (delete existing staging orgs first)
pnpm seed:staging:reset

# Direct execution
tsx scripts/seed-staging.ts
tsx scripts/seed-staging.ts --reset
```

**Environment:**
- `NODE_ENV` must NOT be `production` (safety check)
- `DATABASE_URL` must be set

**Default credentials:**
- Password: `StagingTest2026!` (bcrypt hash cost 10)
- Email format: `owner-{orgId}@exemplo-staging.zappiq.com.br`, `agent{N}-{orgId}@exemplo-staging.zappiq.com.br`
- Superadmin: `rodrigo@zappiq.com.br`

**Success criteria:**
- Console shows `[SEED] ✓ Seeding complete!`
- All 11 organizations visible in dashboard
- Each org has expected user count

---

### `staging-traffic-generator.ts`

**Purpose:** Load test webhook endpoint to measure P95/P99 latency pre-launch.

**When to use:** Before going live to validate API capacity and identify bottlenecks.

**Simulates:**
- Meta/WhatsApp incoming message webhooks
- Concurrent message ingestion across multiple orgs
- Realistic payload structure (numbers, names, timestamps)

**Commands:**

```bash
# Default: 5 orgs, 20 msgs/org, 3 concurrent workers, localhost
pnpm traffic:staging

# Custom configuration
tsx scripts/staging-traffic-generator.ts --orgs 10 --messages-per-org 50 --concurrency 5

# Against staging API
pnpm traffic:staging
# (already configured with staging URL in package.json)

# With time limit (120 seconds)
tsx scripts/staging-traffic-generator.ts --duration 120

# Full example
tsx scripts/staging-traffic-generator.ts \
  --orgs 20 \
  --messages-per-org 100 \
  --concurrency 10 \
  --real-webhook https://api-staging.zappiq.com.br/api/webhook/whatsapp
```

**Output:**
- Real-time progress: `[TRAFFIC] Progress: X/Y | RPS: Z | Errors: E`
- Final report with latency percentiles (P50, P95, P99, min, max, mean)
- Error rate summary

**Success criteria:**
- P95 latency < 1000ms
- Error rate < 5%
- Consistent RPS across concurrency workers

---

### `reset-staging.sh`

**Purpose:** Safely wipe and reseed staging database.

**When to use:** To clean up after integration tests or to reset state before demo.

**Safety checks:**
- Requires confirmation: `YES I AM SURE`
- Verifies DATABASE_URL contains `staging` or `preview`
- Aborts if production keyword detected

**Commands:**

```bash
# Reset all tables, then seed fresh
bash scripts/reset-staging.sh

# Keep users/orgs, reset only data
bash scripts/reset-staging.sh --keep-users

# Using make or package.json (if added)
pnpm reset:staging
```

**What it does:**
1. Prompts for confirmation
2. Validates DATABASE_URL safety
3. Truncates: messages, conversations, contacts, kb_documents, kb_chunks, qa_pairs, tenant_usage_monthly
4. Optionally truncates: users, organizations
5. Auto-runs `seed-staging.ts` to repopulate

**Environment:**
- `DATABASE_URL` required
- Must contain `staging` or `preview` (case-insensitive)

**Success criteria:**
- Console shows `[RESET] ✓ Staging ready for testing`
- Seed completes without errors

---

## Package.json Scripts

Add these to root `package.json`:

```json
{
  "scripts": {
    "seed:staging": "tsx scripts/seed-staging.ts",
    "seed:staging:reset": "tsx scripts/seed-staging.ts --reset",
    "traffic:staging": "tsx scripts/staging-traffic-generator.ts --real-webhook https://api-staging.zappiq.com.br/api/webhook/whatsapp"
  }
}
```

---

## Typical Workflow

### Fresh Staging Setup
```bash
# After environment provisioning
DATABASE_URL=postgresql://... pnpm seed:staging
# Dataset ready for testing
```

### Pre-Launch Validation
```bash
# Measure API performance
pnpm traffic:staging

# If latency acceptable, deploy to production
# If issues, investigate and re-test
```

### Post-Integration-Test Cleanup
```bash
# Blow away test data
bash scripts/reset-staging.sh
# Fresh seed automatically runs
```

### Ongoing Testing
```bash
# Soft reset: keep users, clear conversations
bash scripts/reset-staging.sh --keep-users

# Smoke tests (if available)
bash scripts/smoke-staging.sh
```

---

## Data Generated

### Organizations (10)
All named with `-STAGING` suffix for easy identification:

| Name | Plan | Trial? | Readiness | Notes |
|------|------|--------|-----------|-------|
| Clínica Santa Luz | STARTER | active | 15 | Early trial |
| Varejo Expresso | STARTER | active | 45 | Mid trial |
| Colégio Horizonte | STARTER | active | 72 | Trial at milestone |
| Consultoria Meridiano | GROWTH | converted | 85 | Post-conversion |
| Tech Serviços | GROWTH | converted | 78 | Post-conversion |
| Imobiliária Primus | SCALE | converted | 92 | Scaled customer |
| Banco Corporativo | BUSINESS | converted | 88 | Enterprise |
| Startup Falida | STARTER | expired | 8 | Expired, no conversion |
| Loja Dormida | GROWTH | converted | 65 | 20 days no activity (churn risk) |
| Agência Digital | SCALE | converted | 80 | Active SCALE customer |

### Users
- Each org: 1 ADMIN (owner) + 2 AGENT
- Superadmin: `rodrigo@zappiq.com.br` (ADMIN)
- All emails contain `-STAGING` or `@zappiq.com.br` for identification
- All passwords hashed with bcrypt (cost 10)

### Related Data
- Q&A Pairs: 3-5 per org (vertical-specific)
- KB Documents: 2-3 per org (metadata only, no large files)
- Contacts: 3 per org (Brazilian names + phone numbers)
- Conversations: 1-2 per org (5-15 messages each)
- TenantUsageMonthly: 3 months (Jan-Mar 2026) for converted orgs

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Cannot find module '@zappiq/database'` | Run `pnpm install` in root |
| `DATABASE_URL not set` | Export `DATABASE_URL=postgresql://...` |
| `Safety check failed` | Ensure DATABASE_URL contains `staging` or `preview` |
| `P95 > 1000ms` | Check API CPU/memory; reduce `--concurrency` or `--messages-per-org` |
| `Error rate > 5%` | Verify webhook endpoint is accepting POST requests |
| `Seed creates duplicates` | Script uses upsert; run with `--reset` to clear first |

---

## Notes

- All data is fictional (Brazilian names, companies, phone formats)
- Scripts are idempotent: safe to run multiple times
- Staging password `StagingTest2026!` is intentionally weak—only for non-production
- Traffic generator uses synthetic payload compatible with Meta Webhook format
- Console output includes timestamps and counts for audit
