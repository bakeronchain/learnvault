# Sentry Error Monitoring - Setup & Deployment Guide

Complete guide for setting up centralized error monitoring with Sentry across the LearnVault backend (Express) and frontend (React).

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Sentry Project Setup](#sentry-project-setup)
4. [Backend Setup (Express)](#backend-setup-express)
5. [Frontend Setup (React)](#frontend-setup-react)
6. [Environment Configuration](#environment-configuration)
7. [Release Tracking](#release-tracking)
8. [PII Scrubbing](#pii-scrubbing)
9. [Deployment](#deployment)
10. [Verification](#verification)
11. [Troubleshooting](#troubleshooting)

---

## Overview

This implementation provides:

- **Backend (Express)**: Full error capture with request context, automatic performance tracing
- **Frontend (React)**: Error boundary integration, automatic breadcrumb tracking, session replay
- **PII Protection**: Automatic redaction of wallet addresses (`0x[a-fA-F0-9]{40}`) from all payloads
- **Release Tracking**: Correlation of errors with git commit hashes for deployment tracking
- **Environment Support**: Separate configurations for dev, staging, and production

---

## Prerequisites

- Node.js 18+ and npm
- Sentry account with organization access
- Access to deploy both frontend and backend applications

---

## Sentry Project Setup

### Step 1: Create Sentry Projects

1. Log in to [Sentry](https://sentry.io)
2. Create two projects under your organization:
   - `learnvault-frontend` (platform: React)
   - `learnvault-backend` (platform: Node.js)

### Step 2: Get DSN Keys

For each project:

1. Navigate to **Settings** → **Projects** → [project-name] → **Keys**
2. Copy the **DSN** (Data Source Name)
3. Save both DSNs securely

### Step 3: Configure Organization Settings

1. Go to **Settings** → **General**
2. Enable **Require HTTPS** for production
3. Configure **Data Scrubbing** (additional layer beyond our custom scrubbing)
4. Set up **Teams** and **Access Control** as needed

---

## Backend Setup (Express)

### Installation

The Sentry SDK has already been added to `server/package.json`:

```bash
cd server
npm install
```

Required packages:
- `@sentry/node` - Core Node.js SDK
- `@sentry/profiling-node` - Performance profiling

### Files Created/Modified

1. **`server/src/lib/sentry.ts`** - Sentry initialization and configuration
   - PII scrubbing with wallet address redaction
   - Request context enrichment
   - User context management

2. **`server/src/middleware/error.middleware.ts`** - Updated error handler
   - Captures errors to Sentry with appropriate severity levels
   - Includes request context (path, method, requestId)

3. **`server/src/index.ts`** - Main entry point
   - Sentry initialization at startup
   - Request handler middleware integration

### Usage in Routes

```typescript
import { setSentryUser, captureError } from "../lib/sentry"

// After authentication
setSentryUser(userId, email, walletAddress)

// Manual error capture with context
try {
  // ... risky operation
} catch (error) {
  captureError(error, {
    level: "error",
    tags: { feature: "milestone-approval" },
    extra: { milestoneId, amount }
  })
}
```

---

## Frontend Setup (React)

### Installation

The Sentry SDK has already been added to `package.json`:

```bash
npm install
```

Required packages:
- `@sentry/react` - React integration
- `@sentry/browser` - Browser utilities

### Files Created/Modified

1. **`src/lib/sentry.ts`** - Sentry initialization and configuration
   - PII scrubbing with wallet address redaction
   - React integration with component tracking
   - Session replay configuration
   - Redux enhancer (optional)

2. **`src/main.tsx`** - App entry point
   - Sentry initialization before React render
   - Environment-based configuration

### Usage in Components

```typescript
import { captureError, addBreadcrumb, setSentryUser } from "./lib/sentry"

// After wallet connection
setSentryUser(userId, email, walletAddress)

// Manual error capture
const handleError = (error: Error) => {
  captureError(error, {
    tags: { component: "MilestoneForm" },
    extra: { formData }
  })
}

// Add breadcrumbs for context
addBreadcrumb("User clicked submit button", "ui", "info", { formId })
```

### Error Boundary (Optional)

For additional React error catching, wrap your app:

```typescript
import { ErrorBoundary } from "@sentry/react"

<ErrorBoundary
  fallback={<div>Error occurred</div>}
  onError={(error) => captureError(error)}
>
  <App />
</ErrorBoundary>
```

---

## Environment Configuration

### Frontend (.env)

```bash
# Copy from .env.example
cp .env.example .env

# Add Sentry configuration
VITE_SENTRY_DSN=https://xxx@oXXX.ingest.sentry.io/XXX
VITE_SENTRY_ENVIRONMENT=production
VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE=0.1
VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE=1.0
```

### Backend (server/.env)

```bash
# Copy from server/.env.example
cp server/.env.example server/.env

# Add Sentry configuration
SENTRY_DSN=https://xxx@oXXX.ingest.sentry.io/XXX
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
```

### Environment-Specific Settings

| Environment | Traces Sample Rate | Replay Session Rate | Notes |
|-------------|-------------------|---------------------|-------|
| Development | 1.0 | 0.0 | Full tracing for debugging |
| Staging | 0.5 | 0.1 | Moderate sampling |
| Production | 0.1 | 0.1 | Low sampling to manage quota |

---

## Release Tracking

### Automatic (CI/CD)

Sentry can automatically detect releases from your CI/CD pipeline.

#### GitHub Actions Example

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Get Git Commit Hash
        id: git
        run: echo "COMMIT_HASH=$(git rev-parse --short HEAD)" >> $GITHUB_OUTPUT

      - name: Set Sentry Release (Frontend)
        run: |
          echo "VITE_SENTRY_RELEASE=${{ steps.git.outputs.COMMIT_HASH }}" >> .env
          echo "VITE_GIT_COMMIT_HASH=${{ steps.git.outputs.COMMIT_HASH }}" >> .env

      - name: Set Sentry Release (Backend)
        run: |
          echo "SENTRY_RELEASE=${{ steps.git.outputs.COMMIT_HASH }}" >> server/.env
          echo "GIT_COMMIT_HASH=${{ steps.git.outputs.COMMIT_HASH }}" >> server/.env

      - name: Build and Deploy
        run: |
          npm ci
          npm run build
          # ... deploy steps

      - name: Create Sentry Release
        uses: getsentry/action-release@v1
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: your-org
          SENTRY_PROJECT: learnvault-backend
        with:
          environment: production
          version: ${{ steps.git.outputs.COMMIT_HASH }}
```

### Manual Release Creation

```bash
# Install Sentry CLI
npm install -g @sentry/cli

# Authenticate
sentry login

# Create release
sentry releases new -p learnvault-backend <commit-hash>

# Set commits for the release
sentry releases set-commits <commit-hash> --auto

# Deploy mark
sentry releases deploys <commit-hash> new -e production
```

---

## PII Scrubbing

### What Gets Scrubbed

The implementation automatically redacts:

1. **Wallet Addresses**: Any string matching `0x[a-fA-F0-9]{40}`
   - Replaced with `[REDACTED_WALLET]`
   - Applied to error messages, stack traces, breadcrumbs, contexts

2. **Sensitive Fields**: Automatically excluded from request bodies
   - Fields containing: `password`, `secret`, `token`, `private`

### How It Works

Both frontend and backend implement `beforeSend` filters:

```typescript
// Pattern used for wallet address detection
const WALLET_ADDRESS_REGEX = /0x[a-fA-F0-9]{40}/g

// Applied to all error events before sending to Sentry
function scrubPII(event: Sentry.Event): Sentry.Event {
  // Redacts from:
  // - Exception messages
  // - Stack trace variables
  // - Breadcrumbs
  // - Context data
  // - User context (preserves ID, redacts wallet)
  return event
}
```

### Additional Scrubbing (Sentry Server-Side)

For defense in depth, configure Sentry's built-in scrubbing:

1. Go to **Settings** → **Projects** → [project] → **Security & Privacy**
2. Enable **Data Scrubbing**
3. Add sensitive fields:
   - `walletAddress`
   - `privateKey`
   - `secretKey`
   - `mnemonic`

---

## Deployment

### Docker Deployment

#### Backend Dockerfile Addition

```dockerfile
# Add to your existing Dockerfile
ARG GIT_COMMIT_HASH=unknown
ENV GIT_COMMIT_HASH=${GIT_COMMIT_HASH}
ENV SENTRY_RELEASE=${GIT_COMMIT_HASH}
```

#### Frontend Build

```dockerfile
# Add to your Vite build
ARG VITE_SENTRY_RELEASE
ARG VITE_GIT_COMMIT_HASH
ENV VITE_SENTRY_RELEASE=${VITE_SENTRY_RELEASE}
ENV VITE_GIT_COMMIT_HASH=${VITE_GIT_COMMIT_HASH}
```

### Environment Variables in Production

Ensure these are set in your production environment:

| Variable | Frontend | Backend | Required |
|----------|----------|---------|----------|
| `*_SENTRY_DSN` | ✅ | ✅ | Yes |
| `*_SENTRY_ENVIRONMENT` | ✅ | ✅ | Yes |
| `*_SENTRY_RELEASE` | ✅ | ✅ | Recommended |
| `*_GIT_COMMIT_HASH` | ✅ | ✅ | Recommended |
| `*_TRACES_SAMPLE_RATE` | ✅ | ✅ | Optional |

---

## Verification

### Test Error Capture

#### Backend Test

```bash
# Add a test endpoint (development only)
app.get("/api/test-error", () => {
  throw new Error("Test error - Sentry verification")
})

# Trigger and verify in Sentry dashboard
curl http://localhost:4000/api/test-error
```

#### Frontend Test

```typescript
// Add a test button (development only)
<button onClick={() => {
  throw new Error("Test error - Sentry verification")
}}>
  Test Sentry
</button>
```

### Verification Checklist

- [ ] Errors appear in Sentry dashboard within 30 seconds
- [ ] Wallet addresses are redacted in error details
- [ ] Request context (path, method) is attached to backend errors
- [ ] Breadcrumbs show user actions before errors
- [ ] Release version matches deployment commit hash
- [ ] Environment is correctly labeled
- [ ] Performance traces are captured (check Transactions tab)

---

## Troubleshooting

### Errors Not Appearing

1. **Check DSN**: Verify DSN is correctly set in environment variables
2. **Check Network**: Ensure Sentry.io is accessible from your servers
3. **Check Filters**: Verify no project filters are blocking events
4. **Check Quota**: Ensure you haven't exceeded event quota

### PII Still Visible

1. **Custom Data**: If you manually add contexts, ensure scrubbing is applied
2. **Stack Traces**: Some third-party frames may not be scrubbed
3. **Server-Side**: Enable Sentry's built-in scrubbing as backup

### Performance Impact

If Sentry impacts performance:

1. **Reduce Sample Rates**: Lower `tracesSampleRate` in production
2. **Disable Replay**: Set `replaysSessionSampleRate` to 0
3. **Check Network**: Use Sentry's regional endpoints if available

### TypeScript Errors

If you see TypeScript errors after installation:

```bash
# Regenerate types
npm install --save-dev @types/node
```

---

## Additional Resources

- [Sentry Node.js SDK Docs](https://docs.sentry.io/platforms/javascript/guides/node/)
- [Sentry React SDK Docs](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Alert Rules Configuration](./SENTRY_ALERT_RULES.md)
- [Sentry CLI](https://docs.sentry.io/cli/)

---

## Support

For issues with this integration:

1. Check the Sentry dashboard for error details
2. Review the [Sentry documentation](https://docs.sentry.io/)
3. Contact the platform team via Slack #sentry-support
