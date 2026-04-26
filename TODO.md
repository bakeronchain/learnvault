# TODO: Donor Deposit E2E Test

## Plan

### Step 1: Create `e2e/fixtures/mock-donor-deposit.ts`
- Implement `mockRpcCalls(page)` to intercept `**/rpc**` fetch calls and mock:
  - `getAccount` → returns account with sequence 0
  - `simulateTransaction` → returns success response for `prepareTransaction`
  - `sendTransaction` → returns `SUCCESS` status with fake tx hash
  - `getEvents` → returns a mock `deposit` event for the donor address
- Implement `mockTreasuryApi(page)` to intercept backend APIs:
  - `GET /api/treasury/stats` → updated balance & donor count
  - `GET /api/treasury/activity` → deposit in activity feed
  - `GET /api/governance/voting-power/:address` → GOV balance matching deposit

### Step 2: Create `e2e/donor-deposit.spec.ts`
Implement the 7-step scenario:
1. Connect donor wallet via `installMockFreighter`
2. Navigate to `/donor`
3. Click "Become a Donor →", enter amount `500`, click Deposit
4. Verify GOV token received on `/dao`
5. Verify treasury balance updated on `/treasury`
6. Verify donor dashboard shows contribution on `/donor`

### Step 3: Run test
- `npx playwright test e2e/donor-deposit.spec.ts`

