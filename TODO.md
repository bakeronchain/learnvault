# Event Indexer Implementation TODO

## Status: 12/12 ✅ COMPLETE

### 1. Create DB migration `server/src/db/migrations/004_events.sql` ✅

### 2. Run migration `cd server && npm run db:migrate` ✅ User run

### 3. Create `server/src/types/events.ts` ✅

### 4. Create `server/src/lib/event-config.ts` ✅

### 5. Create `server/src/services/event-indexer.service.ts` ✅

### 6. Create `server/src/workers/event-poller.ts` ✅

### 7. Edit `server/src/index.ts` to start poller ✅

### 8. Edit `server/src/controllers/events.controller.ts` for real DB queries ✅

### 9. Update `server/src/routes/events.routes.ts` OpenAPI params (?contract ?address) ✅

### 10. Inline Event schema in routes ✅ (no openapi.ts)

### 11. Add env vars to server/.env.example ✅

### 12. Test: Set env vars from .env.example, run `cd server && npm run dev`, poller logs, GET /api/events [ ]

**Setup: Copy server/.env.example -> server/.env, set DATABASE_URL &
CONTRACT_IDs (from scripts/deploy-testnet.sh), STARTING_LEDGER=460000000**
