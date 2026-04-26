# Redis Configuration

This document describes the Redis configuration for LearnVault, including memory management, eviction policies, and monitoring.

## Overview

Redis is used in LearnVault for:
- **Nonce storage**: Storing cryptographic nonces for wallet authentication
- **Token blacklisting**: Caching revoked JWT tokens
- **Rate limiting**: (Future use case)

## Configuration

### Development

In development, Redis runs with the following configuration:
- **Max memory**: 256MB
- **Eviction policy**: `allkeys-lru` (Least Recently Used across all keys)
- **Persistence**: Disabled (data loss acceptable for development)

Configuration file: `server/redis.conf`

### Staging

For staging environments:
- **Max memory**: 512MB (configurable via Redis instance settings)
- **Eviction policy**: `allkeys-lru`
- **Persistence**: Disabled (cache use case)

Configure your Redis instance with:
```bash
maxmemory 512mb
maxmemory-policy allkeys-lru
```

### Production

For production environments:
- **Max memory**: 1GB or higher (based on expected load)
- **Eviction policy**: `allkeys-lru`
- **Persistence**: Consider enabling AOF for critical data

Configure your Redis instance with:
```bash
maxmemory 1gb
maxmemory-policy allkeys-lru
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection URL | Optional (degraded mode if not set) |

## Memory Management

### Eviction Policy

We use `allkeys-lru` because:
- Both nonce storage and token caching benefit from LRU eviction
- Nonces and tokens have similar access patterns
- Simple and predictable behavior

### Memory Limits

Memory limits are set to prevent Redis from consuming unlimited memory:
- **Development**: 256MB (sufficient for local development)
- **Staging**: 512MB (handles moderate load)
- **Production**: 1GB+ (scales with application load)

## Monitoring

### Health Check

The `/api/health` endpoint includes Redis connectivity and basic performance metrics.

### Memory Usage

Redis memory usage is monitored via the health check endpoint, which reports:
- Connection status
- Response time
- Memory usage (when available)

### Key Metrics to Monitor

- Memory usage vs. maxmemory
- Eviction events
- Connection count
- Response times

## Deployment

### Docker

For local development, Redis runs in Docker with the configuration file mounted:

```yaml
redis:
  image: redis:7
  volumes:
    - ./redis.conf:/etc/redis/redis.conf
  command: redis-server /etc/redis/redis.conf
```

### Cloud Providers

When deploying to cloud providers (AWS ElastiCache, GCP Memorystore, etc.):
1. Set `maxmemory` appropriate for your instance size
2. Configure `maxmemory-policy allkeys-lru`
3. Enable monitoring and alerts for memory usage
4. Consider enabling persistence for production if data loss is unacceptable

## Troubleshooting

### Memory Issues

If Redis reaches maxmemory:
- Check for memory leaks in application code
- Review key TTL settings
- Consider increasing maxmemory limit
- Monitor eviction rates

### Connection Issues

If Redis connections fail:
- Verify REDIS_URL configuration
- Check network connectivity
- Monitor connection pool usage
- Review Redis server logs

### Performance Issues

For performance problems:
- Monitor response times via health checks
- Check memory fragmentation
- Review eviction statistics
- Consider Redis cluster for high load