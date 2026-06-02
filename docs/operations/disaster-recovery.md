# Disaster Recovery and Backup Procedures

## Scope

This runbook defines backup, retention, and restoration for:

- PostgreSQL primary application database
- Redis cache/session/rate-limit state
- IPFS user and protocol content

It also defines target recovery metrics and recovery test cadence.

## Recovery Targets

| Service       | RTO Target | RPO Target |
| ------------- | ---------- | ---------- |
| PostgreSQL    | 2 hours    | 15 minutes |
| Redis         | 1 hour     | 1 hour     |
| IPFS content  | 8 hours    | 24 hours   |
| Full platform | 8 hours    | 24 hours   |

Definitions:

- RTO (Recovery Time Objective): max acceptable downtime to restore service.
- RPO (Recovery Point Objective): max acceptable data loss window.

## PostgreSQL Backup Schedule and Retention

### Backup method

- Daily full logical dump using `pg_dump -Fc`.
- Continuous WAL archiving using `archive_mode=on` and `archive_command` to
  off-site object storage.
- Weekly restore verification in non-production environment.

### Schedule

- Full backup: every day at `02:00 UTC`.
- WAL archive shipping: continuous (target lag under 5 minutes).
- Integrity check (`pg_restore --list` and checksum validation): immediately
  after each full backup.

### Retention

- Daily full backups: 35 days.
- Weekly full backups (Sunday): 12 weeks.
- Monthly full backups (first day of month): 12 months.
- WAL archives: 35 days minimum (must always cover period between full backups).

### Example implementation notes

- Encrypt backups at rest (SSE-KMS or equivalent) and in transit (TLS).
- Store copies in at least two locations:
  - Primary cloud object storage bucket
  - Secondary cross-region bucket/account
- Restrict restore credentials to break-glass ops role.

## Redis Backup (RDB/AOF Settings)

### Durability profile

Redis is treated as rebuildable for cache-only keys, but persistent for:

- Session state (if not fully stateless)
- Idempotency keys
- Rate-limit counters where continuity matters

### Required settings

Use both RDB snapshots and AOF for mixed durability/performance:

```conf
appendonly yes
appendfsync everysec
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb

save 900 1
save 300 10
save 60 10000

rdbcompression yes
rdbchecksum yes
```

### Redis retention and copy strategy

- Persist Redis data volume snapshots every 6 hours.
- Retain snapshots for 14 days.
- Copy one daily snapshot to off-site/cross-region storage.
- Test Redis restore weekly in staging.

## IPFS Content Backup Strategy

### Data classes

- Pinned user content (must be preserved)
- Application metadata/content-addressed assets (must be preserved)
- Rehydratable/public third-party content (best effort)

### Strategy

- Keep at least 2 independent pinning locations:
  - Primary self-hosted IPFS cluster
  - Secondary pinning provider or secondary cluster
- Export pinset daily (`ipfs pin ls --type=recursive`) and archive results.
- Back up IPFS datastore blocks (`/blocks`) and pin metadata daily.
- Replicate CAR exports of critical collections weekly to off-site object
  storage.

### Retention

- Daily pinset exports: 90 days.
- Datastore backups: 30 days rolling.
- Weekly CAR archives: 26 weeks.

## Step-by-Step Restoration Procedure

## 1. Incident declaration and access control

1. Declare severity and start an incident channel.
2. Assign incident commander and recovery operator.
3. Freeze non-emergency deploys and schema changes.
4. Confirm break-glass credentials and audit logging are active.

## 2. Restore PostgreSQL

1. Provision clean PostgreSQL instance matching production major version.
2. Retrieve latest valid full backup and required WAL segment range.
3. Restore full backup.
4. Replay WAL to target recovery timestamp.
5. Run database validation checks:
   - Row count and checksum spot-checks for critical tables
   - Migration/version table sanity checks
   - Application read/write smoke tests
6. Point application to restored instance and monitor errors/latency.

## 3. Restore Redis

1. Provision clean Redis node/cluster with required `redis.conf` durability
   settings.
2. Restore latest RDB and AOF files (or storage snapshot).
3. Start Redis and verify keyspace load and persistence status.
4. Run application cache/session smoke checks.
5. If needed, invalidate non-critical cache keys to avoid stale read risk.

## 4. Restore IPFS

1. Provision replacement IPFS node/cluster.
2. Restore datastore backup and pin metadata.
3. Re-import CAR archives for critical content.
4. Re-apply latest pinset export.
5. Run pin and retrieval verification for sampled critical CIDs.

## 5. Platform cutover and validation

1. Repoint services/secrets/DNS/load balancer to recovered infrastructure.
2. Run full application smoke and transaction flow tests.
3. Confirm monitoring, alerting, and background workers are healthy.
4. Mark incident as mitigated when SLOs stabilize.

## 6. Post-incident tasks

1. Capture actual RTO/RPO achieved vs targets.
2. Document root cause and permanent corrective actions.
3. Rotate any credentials used during recovery.
4. File follow-up tasks and due dates in ops tracker.

## Tested Recovery Runbook

Run this table-driven drill at least monthly (and after major infra changes).

| Date       | Environment | Scenario                         | Data set            | Target RTO | Actual RTO | Target RPO | Actual RPO | Pass/Fail | Notes/Actions |
| ---------- | ----------- | -------------------------------- | ------------------- | ---------- | ---------- | ---------- | ---------- | --------- | ------------- |
| YYYY-MM-DD | staging     | PostgreSQL point-in-time restore | last 7 days         | 2h         | _TBD_      | 15m        | _TBD_      | _TBD_     |               |
| YYYY-MM-DD | staging     | Redis snapshot + AOF restore     | synthetic prod-like | 1h         | _TBD_      | 1h         | _TBD_      | _TBD_     |               |
| YYYY-MM-DD | staging     | IPFS pinset + CAR recovery       | critical CIDs       | 8h         | _TBD_      | 24h        | _TBD_      | _TBD_     |               |

### Drill acceptance criteria

- Restored platform passes smoke tests with no Sev-1 regressions.
- Measured RTO and RPO meet target thresholds.
- Gaps produce tracked remediation items with owners and deadlines.

### Minimum smoke test checklist

- User authentication and session continuity
- Core read/write API flows
- Background job processing
- Critical content fetch by CID (IPFS)
- Error rate and latency within normal bounds
