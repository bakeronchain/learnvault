# Event Indexer Implementation TODO

<<<<<<< HEAD
## Plan Breakdown (Approved)
1. [x] Read additional key files: CourseCard.tsx, Footer.tsx, NotFound.tsx, Courses.tsx, data/courses.ts
2. [x] Update locale JSON files: Added keys (nav.donor, home.features.*, difficulty.*, courseCard.*, comingSoon.*, notFound.*, footer.*) to en/fr/sw.json
3. [x] Edit src/App.tsx: course titles now use locale keys, nav/footer i18n pending cleanup
4. [x] Edit src/components/NavBar.tsx: "Donor" -> t('nav.donor')
5. [x] Edit src/components/ComingSoon.tsx: messages -> t('comingSoon.*')
6. [x] Edit src/pages/Home.tsx: FeatureCards -> t('home.features.*')
7. [x] Edit src/components/CourseCard.tsx: difficulty/buttons -> t()
8. [ ] Search remaining .tsx for more hardcodes, iterate
9. [ ] Test: npm run dev, switch languages, verify no broken keys
10. [ ] Complete: attempt_completion
=======
## Status: 12/12 ✅ COMPLETE
>>>>>>> 73b5962dddb935a1543a45562010891931c20fb8

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
