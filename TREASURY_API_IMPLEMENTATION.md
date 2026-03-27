# Treasury API Implementation

## Overview

This implementation adds two new API endpoints to fetch real treasury data from
the ScholarshipTreasury smart contract on Stellar/Soroban, and connects the
frontend Treasury page to consume this data.

## Backend Endpoints

### GET /api/treasury/stats

Returns aggregated treasury statistics.

**Response:**

```json
{
	"total_deposited_usdc": "125400000000",
	"total_disbursed_usdc": "98200000000",
	"scholars_funded": 128,
	"active_proposals": 12,
	"donors_count": 47
}
```

### GET /api/treasury/activity

Returns recent treasury activity with pagination.

**Query Parameters:**

- `limit` (optional): Max events to return (1-100, default: 20)
- `offset` (optional): Number of events to skip (default: 0)

**Response:**

```json
{
	"events": [
		{
			"type": "deposit",
			"amount": "500000000",
			"address": "G...",
			"tx_hash": "...",
			"created_at": "2024-01-01T00:00:00Z"
		}
	]
}
```

## Frontend Integration

The Treasury page (`src/pages/Treasury.tsx`) now:

- Fetches real-time stats and activity on component mount
- Displays loading states while fetching data
- Formats USDC amounts from stroops (divides by 10^7)
- Formats addresses and timestamps for better UX
- Shows "No activity yet" when no events exist
- Handles API errors gracefully

## Files Created

- `server/src/controllers/treasury.controller.ts` - Business logic
- `server/src/routes/treasury.routes.ts` - Route definitions

## Files Modified

- `server/src/index.ts` - Registered treasury routes
- `src/pages/Treasury.tsx` - Connected to API endpoints
- `.env.example` - Added VITE_SERVER_URL configuration

## Configuration

### Backend (.env in server/)

Requires `SCHOLARSHIP_TREASURY_CONTRACT_ID` in `server/.env`

### Frontend (.env in root)

Requires `VITE_SERVER_URL` (defaults to http://localhost:4000)

## Testing

1. Start the backend: `cd server && npm run dev`
2. Start the frontend: `npm run dev`
3. Visit http://localhost:5173/treasury
4. Verify stats and activity load from the API
