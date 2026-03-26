# Security Improvements

## CORS Configuration (Implemented)

### Overview
Implemented strict Cross-Origin Resource Sharing (CORS) policies to restrict API access to authorized frontend domains only.

### Changes Made

#### 1. Environment Configuration
- Added `FRONTEND_URL` environment variable for explicit origin control
- Maintained backward compatibility with legacy `CORS_ORIGIN` variable
- Updated `server/.env.example` with comprehensive documentation

#### 2. Dynamic Origin Validation
Replaced simple origin string with dynamic validation function:

```typescript
// Before
app.use(cors({ origin: env.CORS_ORIGIN }))

// After
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      console.warn(`CORS blocked request from origin: ${origin}`)
      callback(new Error("Not allowed by CORS"))
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}))
```

#### 3. Environment-Specific Origins

**Production Mode:**
- `FRONTEND_URL` (from environment)
- `https://learnvault.app`
- `https://www.learnvault.app`

**Development Mode:**
- All production origins (for testing)
- `http://localhost:5173` (Vite)
- `http://localhost:3000` (React/Next.js)
- `http://localhost:5174` (Vite alternate)
- `http://127.0.0.1:5173` (localhost IP)

#### 4. Security Features

- **Credentials Support**: Enabled `credentials: true` for authenticated requests
- **Method Restrictions**: Limited to necessary HTTP methods
- **Header Restrictions**: Only allow `Content-Type` and `Authorization`
- **Audit Logging**: Log all blocked CORS requests for security monitoring
- **No-Origin Allowance**: Allow server-to-server and mobile app requests

### Security Benefits

1. **Prevents Unauthorized Access**
   - Only whitelisted domains can access the API
   - Blocks phishing sites and malicious third parties
   - Mitigates CSRF attacks

2. **Protects User Data**
   - Authentication tokens only sent to trusted domains
   - Personal data cannot be accessed by unauthorized sites
   - Rate limits apply per origin

3. **Audit Trail**
   - All blocked requests are logged
   - Helps identify security threats
   - Enables monitoring of unauthorized access attempts

### Files Modified

- `server/src/index.ts` - Implemented dynamic CORS validation
- `server/.env.example` - Added `FRONTEND_URL` and cleaned up configuration

### Documentation Created

- `docs/cors-configuration.md` - Comprehensive CORS setup guide
- `docs/security-improvements.md` - This file

### Testing

To test the CORS configuration:

```bash
# Test allowed origin
curl -H "Origin: https://learnvault.app" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     http://localhost:4000/api/courses

# Test blocked origin (should fail)
curl -H "Origin: https://malicious-site.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     http://localhost:4000/api/courses
```

### Migration Guide

For existing deployments:

1. Add `FRONTEND_URL` to your environment variables:
   ```env
   FRONTEND_URL=https://your-frontend-domain.com
   ```

2. Restart the backend server

3. Verify CORS headers in browser DevTools Network tab

4. (Optional) Remove legacy `CORS_ORIGIN` variable

### Future Enhancements

Consider implementing:

1. **Dynamic Subdomain Support**
   - Allow all `*.learnvault.app` subdomains
   - Useful for preview deployments and staging

2. **Rate Limiting per Origin**
   - Different rate limits for different origins
   - Stricter limits for unknown origins

3. **Origin Allowlist Management**
   - Admin API to add/remove allowed origins
   - Database-backed origin configuration

4. **CORS Metrics**
   - Track blocked requests by origin
   - Alert on suspicious patterns
   - Dashboard for CORS analytics

## Additional Security Recommendations

### 1. Content Security Policy (CSP)
Add CSP headers to prevent XSS attacks:

```typescript
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
  )
  next()
})
```

### 2. Rate Limiting Enhancements
- Implement per-user rate limits
- Add stricter limits for sensitive endpoints
- Use Redis for distributed rate limiting

### 3. Request Validation
- Validate all input data with Zod schemas
- Sanitize user input to prevent injection attacks
- Implement request size limits

### 4. Authentication Hardening
- Implement token rotation
- Add refresh token mechanism
- Set appropriate token expiration times
- Use secure cookie flags (HttpOnly, Secure, SameSite)

### 5. API Security Headers
Add security headers middleware:

```typescript
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  next()
})
```

### 6. Dependency Security
- Regularly update dependencies
- Use `npm audit` to check for vulnerabilities
- Implement automated security scanning in CI/CD

### 7. Logging and Monitoring
- Log all authentication attempts
- Monitor for suspicious patterns
- Set up alerts for security events
- Implement request tracing

### 8. Database Security
- Use parameterized queries (already using pg)
- Implement row-level security in PostgreSQL
- Encrypt sensitive data at rest
- Regular database backups

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
