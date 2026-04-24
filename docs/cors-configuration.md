# CORS Configuration

## Overview

The LearnVault backend implements strict Cross-Origin Resource Sharing (CORS)
policies to ensure only authorized frontend domains can make API requests. This
prevents unauthorized websites from accessing the API and protects user data.

## Configuration

### Environment Variables

Set the `FRONTEND_URL` environment variable to specify the allowed frontend
origin:

```env
# Development
FRONTEND_URL=http://localhost:5173

# Production
FRONTEND_URL=https://learnvault.app
```

### Allowed Origins

The backend automatically configures the following allowed origins:

#### Production Mode (`NODE_ENV=production`)

- `FRONTEND_URL` (from environment variable)
- `https://learnvault.app` (production domain)
- `https://www.learnvault.app` (production domain with www)

#### Development Mode (`NODE_ENV=development`)

- All production origins (for testing)
- `http://localhost:5173` (Vite default)
- `http://localhost:3000` (React/Next.js default)
- `http://localhost:5174` (Vite alternate port)
- `http://127.0.0.1:5173` (localhost IP variant)

### CORS Settings

The backend is configured with the following CORS options:

```typescript
{
  origin: (origin, callback) => {
    // Dynamic origin validation
  },
  credentials: true,              // Allow cookies and auth headers
  methods: [                       // Allowed HTTP methods
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS"
  ],
  allowedHeaders: [                // Allowed request headers
    "Content-Type",
    "Authorization"
  ]
}
```

## How It Works

### Origin Validation

When a browser makes a cross-origin request:

1. The browser sends a preflight OPTIONS request with the `Origin` header
2. The backend checks if the origin is in the `allowedOrigins` list
3. If allowed, the backend responds with appropriate CORS headers
4. If blocked, the backend logs a warning and returns a CORS error

### No-Origin Requests

Requests without an `Origin` header are automatically allowed. This includes:

- Server-to-server API calls
- Mobile app requests
- Command-line tools (curl, Postman)
- Same-origin requests

### Credentials Support

The `credentials: true` setting allows:

- Cookies to be sent with cross-origin requests
- Authorization headers to be included
- Authenticated API calls from the frontend

## Security Benefits

### Prevents Unauthorized Access

Only whitelisted domains can make API requests, preventing:

- Phishing sites from accessing the API
- Unauthorized third-party integrations
- Cross-site request forgery (CSRF) attacks

### Protects User Data

By restricting origins:

- User authentication tokens are only sent to trusted domains
- Personal data cannot be accessed by malicious websites
- API rate limits apply per origin

### Audit Trail

Blocked CORS requests are logged:

```
CORS blocked request from origin: https://malicious-site.com
```

This helps identify potential security threats and unauthorized access attempts.

## Development Setup

### Local Development

For local development, the default configuration works out of the box:

```bash
# Start the backend (defaults to http://localhost:5173)
cd server
npm run dev
```

### Custom Port

If your frontend runs on a different port, set `FRONTEND_URL`:

```bash
# .env
FRONTEND_URL=http://localhost:3000
```

### Multiple Developers

Each developer can use their own `.env` file:

```bash
# Developer A
FRONTEND_URL=http://localhost:5173

# Developer B
FRONTEND_URL=http://localhost:3000
```

## Production Deployment

### Setting the Frontend URL

In production, always set `FRONTEND_URL` to your deployed frontend domain:

```bash
# Production environment
NODE_ENV=production
FRONTEND_URL=https://learnvault.app
```

### Multiple Domains

If you need to support multiple production domains, update the `allowedOrigins`
array in `server/src/index.ts`:

```typescript
const allowedOrigins = [
	env.FRONTEND_URL || env.CORS_ORIGIN || "http://localhost:5173",
	"https://learnvault.app",
	"https://www.learnvault.app",
	"https://app.learnvault.xyz", // Add additional domains
	"https://staging.learnvault.app",
]
```

### Subdomain Support

To allow all subdomains, modify the origin validation logic:

```typescript
origin: (origin, callback) => {
	if (!origin) {
		return callback(null, true)
	}

	// Allow all *.learnvault.app subdomains
	if (origin.endsWith(".learnvault.app")) {
		return callback(null, true)
	}

	if (allowedOrigins.includes(origin)) {
		callback(null, true)
	} else {
		console.warn(`CORS blocked request from origin: ${origin}`)
		callback(new Error("Not allowed by CORS"))
	}
}
```

## Testing CORS

### Test Allowed Origin

```bash
curl -H "Origin: https://learnvault.app" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://localhost:4000/api/courses
```

Expected response headers:

```
Access-Control-Allow-Origin: https://learnvault.app
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS
Access-Control-Allow-Headers: Content-Type,Authorization
```

### Test Blocked Origin

```bash
curl -H "Origin: https://malicious-site.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     http://localhost:4000/api/courses
```

Expected: CORS error and warning in server logs

### Browser Testing

Open the browser console on an unauthorized domain and try:

```javascript
fetch("http://localhost:4000/api/courses", {
	method: "GET",
	credentials: "include",
})
	.then((r) => r.json())
	.catch((err) => console.error("CORS blocked:", err))
```

## Troubleshooting

### CORS Error in Development

If you see CORS errors in development:

1. Check that `FRONTEND_URL` matches your frontend URL
2. Verify the frontend is running on the expected port
3. Check server logs for "CORS blocked" warnings
4. Ensure `NODE_ENV` is set to `development`

### CORS Error in Production

If you see CORS errors in production:

1. Verify `FRONTEND_URL` is set correctly
2. Check that the domain matches exactly (including https://)
3. Ensure `NODE_ENV=production` is set
4. Check for typos in the domain name
5. Review server logs for blocked origins

### Credentials Not Sent

If cookies or auth headers aren't being sent:

1. Ensure `credentials: 'include'` is set in fetch requests
2. Verify `credentials: true` is set in CORS config
3. Check that the origin is in the allowed list
4. Ensure cookies have the correct `SameSite` attribute

## Migration from Legacy Config

### Old Configuration

```typescript
app.use(cors({ origin: env.CORS_ORIGIN }))
```

### New Configuration

```typescript
app.use(cors({
  origin: (origin, callback) => {
    // Dynamic validation
  },
  credentials: true,
  methods: [...],
  allowedHeaders: [...]
}))
```

### Environment Variables

Old:

```env
CORS_ORIGIN=http://localhost:5173
```

New (recommended):

```env
FRONTEND_URL=http://localhost:5173
```

The old `CORS_ORIGIN` variable is still supported for backward compatibility but
`FRONTEND_URL` is preferred.

## References

- [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Express CORS Middleware](https://expressjs.com/en/resources/middleware/cors.html)
- [OWASP: CORS Security](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
