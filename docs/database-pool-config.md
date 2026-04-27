# Database Connection Pooling Configuration

## Overview

The LearnVault server uses PostgreSQL with `pg.Pool` for connection pooling.
This document outlines the pool configuration, monitoring, and best practices
for different environments.

## Features

- **Explicit Pool Configuration**: Defined max, min, idleTimeoutMillis, and
  connectionTimeoutMillis for each environment
- **Health Monitoring**: Real-time pool statistics and capacity tracking
- **Alert System**: Automatic warnings when pool approaches capacity thresholds
- **Metrics Dashboard**: Dedicated endpoints for monitoring pool health
- **Environment-Specific Sizing**: Optimized pool sizes for development,
  staging, and production

## Configuration

The pool configuration is defined in `server/src/db/index.ts` and is
automatically selected based on the `NODE_ENV` environment variable.

### Pool Configuration by Environment

#### Production

```
max: 20                          # Maximum connections
min: 4                           # Minimum connections (pre-allocated)
idleTimeoutMillis: 30000         # Idle connection timeout (30 seconds)
connectionTimeoutMillis: 5000    # Connection timeout (5 seconds)
```

**Rationale**: Production environments handle high concurrent traffic. The
higher max connections ensure sufficient capacity for peak load. The minimum of
4 maintains pre-allocated connections for immediate availability.

#### Staging

```
max: 15                          # Maximum connections
min: 2                           # Minimum connections (pre-allocated)
idleTimeoutMillis: 30000         # Idle connection timeout (30 seconds)
connectionTimeoutMillis: 5000    # Connection timeout (5 seconds)
```

**Rationale**: Staging environments simulate production but typically handle
lower traffic. The moderate pool size balances resource efficiency with
readiness.

#### Development

```
max: 5                           # Maximum connections
min: 1                           # Minimum connections (pre-allocated)
idleTimeoutMillis: 30000         # Idle connection timeout (30 seconds)
connectionTimeoutMillis: 5000    # Connection timeout (5 seconds)
```

**Rationale**: Development environments operate on single machines with limited
resources. A smaller pool is sufficient and prevents resource exhaustion.

## Monitoring

### Health Check Endpoint

The `/api/health` endpoint now includes comprehensive pool statistics:

```bash
GET /api/health
```

Response includes:

```json
{
	"status": "ok",
	"timestamp": "2024-01-15T10:30:00.000Z",
	"database": {
		"connected": true,
		"pool": {
			"total": 20,
			"active": 8,
			"idle": 12,
			"waiting": 0,
			"capacityUsagePercent": 40,
			"isNearCapacity": false,
			"maxConnections": 20,
			"minConnections": 4,
			"idleTimeoutMillis": 30000,
			"connectionTimeoutMillis": 5000
		},
		"alert": null
	}
}
```

### Pool Metrics Endpoint

The `/api/metrics/pool` endpoint provides detailed pool metrics for monitoring
dashboards:

```bash
GET /api/metrics/pool
```

Response includes:

```json
{
	"timestamp": "2024-01-15T10:30:00.000Z",
	"metrics": {
		"pool": {
			"total": 20,
			"active": 8,
			"idle": 12,
			"waiting": 0,
			"capacityUsagePercent": 40,
			"isNearCapacity": false,
			"capacityThresholds": {
				"warningPercent": 80,
				"criticalPercent": 95
			},
			"configuration": {
				"maxConnections": 20,
				"minConnections": 4,
				"idleTimeoutMillis": 30000,
				"connectionTimeoutMillis": 5000
			}
		},
		"lastAlert": null
	},
	"debug": {
		"clientCount": 12,
		"waitingCount": 0,
		"idlingCount": 12
	}
}
```

### Reset Pool Alerts

Reset pool alerts (typically called by external monitoring systems):

```bash
POST /api/metrics/pool/alerts/reset
```

## Alert System

The pool monitor automatically generates alerts when the connection pool
approaches capacity:

### Warning Alert (80% Capacity)

- Level: `warning`
- Triggered when: `activeConnections >= 80% of maxConnections`
- Cooldown: 10 minutes (prevents alert spam)
- Example: Pool at 80% capacity with 16 active connections out of 20

### Critical Alert (95% Capacity)

- Level: `critical`
- Triggered when: `activeConnections >= 95% of maxConnections`
- Cooldown: 5 minutes (prevents alert spam)
- Example: Pool at 95% capacity with 19 active connections out of 20

Alert messages appear in:

1. Server logs with appropriate severity level
2. Health check response (in `database.alert`)
3. Metrics endpoint (in `metrics.lastAlert`)

## Recommended Best Practices

### 1. Monitor Pool Capacity

- Check `/api/metrics/pool` regularly (recommend every 1 minute in production)
- Set up alerts in your monitoring system when `capacityUsagePercent > 80`

### 2. Connection Timeouts

- Production pools wait up to 5 seconds for an available connection
- If timeout is exceeded frequently, your max pool size may be too small

### 3. Idle Connection Management

- Connections idle for 30 seconds are automatically returned to the pool
- This prevents connection leaks and reduces resource consumption

### 4. Scaling Guidelines

**When to increase pool size:**

- Consistently high `capacityUsagePercent` (>65%)
- Frequent warning or critical alerts
- High `waitingCount` in metrics
- Increase `max` by 5-10 connections per adjustment

**When to decrease pool size:**

- Consistently low `capacityUsagePercent` (<30%)
- `idle` count consistently equals `total`
- Reduce `min` first, then `max` if stable

### 5. Environment-Specific Adjustments

You can override defaults by setting these environment variables:

```bash
# Override pool configuration
POOL_MAX=25
POOL_MIN=5
POOL_IDLE_TIMEOUT=45000
POOL_CONNECTION_TIMEOUT=8000
```

### 6. Performance Tuning

For high-traffic applications:

```
Recommended Production Settings:
- max: 30-50 (depends on concurrent load)
- min: 5-10 (pre-allocate for steady traffic)
- connectionTimeoutMillis: 10000 (allow longer waits during spikes)
```

### 7. Database Server Limits

**PostgreSQL Default Settings:**

- `max_connections`: 100 (default)
- Leave buffer of at least 10 connections for system processes

**Connection Math:**

```
Total Connections = (servers × pool.max) + system_buffer
Total Connections ≤ PostgreSQL max_connections

Example for 2 application servers with pool.max=20:
2 × 20 + 10 ≤ 100 ✓ Safe
```

## Debugging

### Enable Debug Logging

Set environment variable to get detailed pool statistics every minute:

```bash
NODE_ENV=development
```

This will log pool stats like:

```
[pool-monitor] Stats - Active: 3/5, Usage: 60%
```

### Check Pool Debug Info

The metrics endpoint includes debug information:

```json
"debug": {
  "clientCount": 12,
  "waitingCount": 0,
  "idlingCount": 12
}
```

Meanings:

- `clientCount`: Number of available idle clients
- `waitingCount`: Clients waiting for a connection
- `idlingCount`: Idle connections in the pool

## Integration with Monitoring Systems

### Datadog Integration

```javascript
// Send metrics to Datadog
const metrics = await fetch("/api/metrics/pool").then((r) => r.json())
statsd.gauge("db.pool.active", metrics.metrics.pool.active)
statsd.gauge(
	"db.pool.capacity_usage",
	metrics.metrics.pool.capacityUsagePercent,
)
```

### Prometheus Integration

```javascript
// Expose metrics for Prometheus scraping
app.get('/metrics', (req, res) => {
  const poolStats = await fetch('/api/metrics/pool').then(r => r.json());
  res.type('text/plain').send(`
# HELP db_pool_active Active connections
# TYPE db_pool_active gauge
db_pool_active ${poolStats.metrics.pool.active}
  `);
});
```

## Troubleshooting

### Issue: "Pool is exhausted" Error

**Cause**: All connections are in use and connection timeout exceeded
**Solution**:

1. Check metrics: `activeConnections > maxConnections - 1`
2. Increase `max` pool size
3. Review application queries for long-running operations
4. Add connection pooling at application level

### Issue: High Memory Usage

**Cause**: Too many idle connections consuming resources **Solution**:

1. Reduce `max` pool size gradually
2. Decrease `idleTimeoutMillis` to remove idle connections faster
3. Monitor `idle` count in metrics

### Issue: Frequent Connection Timeouts

**Cause**: Application cannot acquire connections quickly enough **Solution**:

1. Increase `connectionTimeoutMillis`
2. Increase pool `max` size
3. Optimize database queries to run faster

## Configuration Files

- Pool configuration: [server/src/db/index.ts](../../server/src/db/index.ts)
- Pool monitor service:
  [server/src/services/pool-monitor.service.ts](../../server/src/services/pool-monitor.service.ts)
- Health controller:
  [server/src/controllers/health.controller.ts](../../server/src/controllers/health.controller.ts)
- Metrics controller:
  [server/src/controllers/metrics.controller.ts](../../server/src/controllers/metrics.controller.ts)

## References

- [Node.js pg Library Documentation](https://node-postgres.com/)
- [PostgreSQL Connection Management](https://www.postgresql.org/docs/current/runtime-config-connection.html)
- [Database Connection Pooling Best Practices](https://wiki.postgresql.org/wiki/Number_Of_Database_Connections)
