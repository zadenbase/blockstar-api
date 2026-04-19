# Blockstar Backend API

**Express.js server** with all endpoints wired up. Ready for Supabase integration & x402 payments.

## Quick Start

```bash
cd ~/blockstar-api
npm install
cp .env.example .env
# Edit .env with Supabase credentials
npm run dev
```

Server runs on `http://localhost:3000`

## Endpoints

### Authentication

#### `POST /auth/verify`
Verify wallet signature and get session token.

```bash
curl -X POST http://localhost:3000/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x1234...",
    "signature": "0xabcd..."
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGc...",
    "expiresAt": 1713360000,
    "user": {
      "walletAddress": "0x1234...",
      "totalBalance": 0,
      "firstActivityAt": "2026-04-17T...",
      "lastActivityAt": "2026-04-17T...",
      "updatedAt": "2026-04-17T..."
    }
  },
  "timestamp": "2026-04-17T..."
}
```

#### `POST /auth/qr`
Generate QR code for CLI wallet connection.

```bash
curl -X POST http://localhost:3000/auth/qr
```

---

### Marketplace

#### `GET /marketplace/listings`
Search agent profiles.

**Query params:**
- `page` (1) - Page number
- `limit` (10) - Results per page
- `riskTier` (optional) - Filter: `low`, `medium`, `high`, `extreme`
- `region` (optional) - Filter: `APAC`, `EU`, `AMERICAS`

```bash
curl "http://localhost:3000/marketplace/listings?page=1&limit=10&riskTier=high&region=APAC"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "listings": [...],
    "agents": [...],
    "total": 100,
    "page": 1,
    "limit": 10,
    "pages": 10
  },
  "timestamp": "..."
}
```

#### `GET /marketplace/agents/:id`
Get single agent profile.

```bash
curl "http://localhost:3000/marketplace/agents/550e8400-e29b-41d4-a716-446655440000"
```

---

### Purchases

#### `POST /purchases`
Buy an agent profile (requires auth).

```bash
curl -X POST http://localhost:3000/purchases \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "agentProfileId": "..." }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "purchase-uuid",
    "userId": "0x...",
    "agentProfileId": "...",
    "purchasedAt": "2026-04-17T...",
    "purchasePrice": 0.5,
    "extractionStartTime": "2026-04-17T...",
    "extractionEndTime": "2026-04-18T...",
    "status": "purchased"
  }
}
```

#### `GET /purchases/pending`
Get pending extractions (requires auth).

```bash
curl "http://localhost:3000/purchases/pending" \
  -H "Authorization: Bearer <token>"
```

#### `GET /purchases/history`
Get past extractions (requires auth).

```bash
curl "http://localhost:3000/purchases/history?limit=20" \
  -H "Authorization: Bearer <token>"
```

---

### Extractions

#### `GET /extractions/:id/preview`
Preview extraction reward without actually extracting. Shows expected reward with full breakdown.

```bash
curl "http://localhost:3000/extractions/purchase-uuid/preview" \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "purchaseId": "purchase-uuid",
    "agentId": "...",
    "agentName": "XR-4729",
    "agentRiskTier": "medium",
    "agentVolatilityMod": 1.22,
    "expectedReward": 0.61,
    "rewardBreakdown": {
      "baseAmount": 0.50,
      "volatilityMultiplier": 1.22,
      "probabilityTier": "common (70%)",
      "calculation": "$0.50 × 1.22 = $0.61"
    },
    "currentBalance": 10.50,
    "projectedBalance": 11.11,
    "note": "This is a preview. Actual reward will be the same if extracted today.",
    "canExtract": true
  },
  "timestamp": "2026-04-17T..."
}
```

#### `POST /extractions/:id/initiate`
Start extraction and generate reward. Creates a ledger entry with full agent details.

```bash
curl -X POST http://localhost:3000/extractions/purchase-uuid/initiate \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "purchaseId": "...",
    "agentId": "...",
    "agentName": "XR-4729",
    "agentRiskTier": "medium",
    "agentVolatilityMod": 1.22,
    "reward": 0.61,
    "status": "completed",
    "previousBalance": 10.50,
    "newBalance": 11.11
  }
}
```

---

### Master Agent Trading

Real-time BTC trading with user-controlled closing. Enter a trade and close anytime within 1 hour to lock in profits.

#### `GET /master-agent/signal`
Get live trading signal based on Bollinger Bands (30s cache).

```bash
curl "http://localhost:3000/master-agent/signal"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "signal": "FADE",
    "direction": "SHORT",
    "grade": "A+",
    "confidence": 87,
    "bandPos": 0.95,
    "btcPrice": 84750.00,
    "upper": 85100.00,
    "lower": 84200.00,
    "mean": 84650.00,
    "ts": "2026-04-17T..."
  }
}
```

#### `GET /master-agent/tiers`
Get leverage and risk/reward for each tier.

```bash
curl "http://localhost:3000/master-agent/tiers"
```

#### `POST /master-agent/enter`
Enter a trade at current BTC price. Trade stays active up to 1 hour.

```bash
curl -X POST http://localhost:3000/master-agent/enter \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "tier": "medium" }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "0x123...-1713360000000",
    "signal": "FADE",
    "direction": "SHORT",
    "grade": "A+",
    "confidence": 87,
    "entryPrice": 84750.00,
    "tier": "medium",
    "leverage": 15,
    "tp_pct": "1.2",
    "sl_pct": "0.6",
    "maxDurationSec": 3600,
    "message": "// SHORT entered at $84750.00 — close anytime within 60 minutes",
    "ts": "2026-04-17T..."
  }
}
```

#### `GET /master-agent/pnl`
Get **live P&L** for active trade without closing. Poll this endpoint to watch profits grow!

```bash
curl "http://localhost:3000/master-agent/pnl" \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "0x123...-1713360000000",
    "signal": "FADE",
    "grade": "A+",
    "direction": "SHORT",
    "entryPrice": 84750.00,
    "currentBTCPrice": 84200.00,
    "btcChangePct": -0.649,
    "leverage": 15,
    "positionUsd": 75.00,
    "grossPnl": 0.4875,
    "fees": 0.01,
    "netPnl": 0.4775,
    "profitable": true,
    "tradeDurationSec": 45,
    "remainingSec": 3555,
    "maxDurationSec": 3600,
    "canClose": true,
    "minDurationSec": 1,
    "autoCloseReason": null,
    "tpPct": "1.2",
    "slPct": "0.6",
    "ts": "2026-04-17T..."
  }
}
```

**Key fields:**
- `netPnl` - Current profit/loss (can be positive or negative)
- `canClose` - Whether you can close now (after 1 second min)
- `remainingSec` - Seconds left before auto-close
- `autoCloseReason` - `null` while open, or `take_profit`/`stop_loss`/`max_duration` if triggered

#### `POST /master-agent/resolve`
Close the trade and lock in P&L. Can be called anytime after 1 second, up to 1 hour.

```bash
curl -X POST http://localhost:3000/master-agent/resolve \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "sessionId": "0x123...-1713360000000" }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "0x123...-1713360000000",
    "signal": "FADE",
    "grade": "A+",
    "direction": "SHORT",
    "entryPrice": 84750.00,
    "exitPrice": 84200.00,
    "btcChangePct": -0.649,
    "leverage": 15,
    "positionUsd": 75.00,
    "grossPnl": 0.4875,
    "fees": 0.01,
    "netPnl": 0.4775,
    "outcome": "market",
    "profitable": true,
    "rewardAmount": 0.4775,
    "lossAmount": 0,
    "tradeDurationSec": 45,
    "ts": "2026-04-17T..."
  }
}
```

**Trading Strategy:**
1. Enter when you see a strong signal (A+ grade recommended)
2. Poll `/pnl` every few seconds to watch your profit
3. When `netPnl` spikes high, hit `/resolve` to lock it in!
4. Trade auto-closes after 1 hour if you don't close it

**Fees:** 0.2% round-trip (0.1% entry + 0.1% exit)

**Cooldown:** 5 minutes between trades (prevents spam)

---

### Balance

#### `GET /users/:wallet/balance`
Get user balance (requires auth).

```bash
curl "http://localhost:3000/users/0x1234.../balance" \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "walletAddress": "0x...",
    "totalBalance": 12.45,
    "firstActivityAt": "2026-04-17T...",
    "lastActivityAt": "2026-04-17T...",
    "payoutEligibleAt": null,
    "updatedAt": "2026-04-17T..."
  }
}
```

#### `GET /users/:wallet/balance-history`
Get transaction history (requires auth). Every extraction, purchase, and payout is logged with metadata.

```bash
curl "http://localhost:3000/users/0x1234.../balance-history?limit=20" \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ledger-uuid",
      "user_id": "0x1234...",
      "amount": 0.61,
      "transaction_type": "extraction",
      "related_purchase_id": "purchase-uuid",
      "metadata": "{\"agentName\":\"XR-4729\",\"agentId\":\"...\",\"note\":\"Extracted $0.61 from XR-4729 (medium tier, 1.22x volatility)\"}",
      "parsedMetadata": {
        "agentName": "XR-4729",
        "agentId": "...",
        "note": "Extracted $0.61 from XR-4729 (medium tier, 1.22x volatility)"
      },
      "created_at": "2026-04-17T..."
    },
    {
      "id": "ledger-uuid-2",
      "user_id": "0x1234...",
      "amount": -5.00,
      "transaction_type": "purchase",
      "related_purchase_id": null,
      "metadata": "{\"agentName\":\"APEX-1234\",\"agentRiskTier\":\"medium\",\"note\":\"Purchased APEX-1234 (medium tier) for $5\"}",
      "parsedMetadata": {
        "agentName": "APEX-1234",
        "agentRiskTier": "medium",
        "note": "Purchased APEX-1234 (medium tier) for $5"
      },
      "created_at": "2026-04-17T..."
    }
  ],
  "timestamp": "2026-04-17T..."
}
```

**Transaction Types:**
- `extraction` — Agent extraction reward (positive) or master agent trade loss (negative)
- `purchase` — Agent purchase cost (negative)
- `payout` — Withdrawal request (negative)
- `admin_credit` / `admin_debit` — Admin balance adjustments

---

### Payouts

#### `POST /payouts/request`
Request withdrawal (requires 30+ days activity).

```bash
curl -X POST http://localhost:3000/payouts/request \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "amountRequested": 5.0 }'
```

#### `GET /payouts/:id/status`
Check payout status (requires auth).

```bash
curl "http://localhost:3000/payouts/payout-uuid/status" \
  -H "Authorization: Bearer <token>"
```

#### `GET /users/:wallet/payouts`
Get payout history (requires auth).

```bash
curl "http://localhost:3000/payouts/users/0x1234.../payouts" \
  -H "Authorization: Bearer <token>"
```

---

## Error Responses

All errors return consistent format:

```json
{
  "success": false,
  "error": "Error message here",
  "timestamp": "2026-04-17T..."
}
```

**Status codes:**
- `400` - Bad request (validation)
- `401` - Unauthorized (missing/invalid auth)
- `403` - Forbidden (insufficient permissions)
- `404` - Not found
- `500` - Server error

---

## Authentication

Use Bearer token from `/auth/verify`:

```bash
Authorization: Bearer eyJhbGc...
```

Tokens expire after 24 hours.

---

## Database

See `SCHEMA.sql` for full Supabase schema.

Tables:
- `agent_profiles` - 500+ pre-generated trading profiles
- `marketplace_listings` - Always 100 active listings
- `users` - User profiles & activity tracking
- `purchases` - Extraction records
- `balance_ledger` - Transaction history
- `payout_requests` - Withdrawal requests

---

## Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=development

# Database
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx

# Auth
JWT_SECRET=your-secret-key

# Web3
X402_CONTRACT_ADDRESS=0x...
USDC_CONTRACT_ADDRESS=0x...

# CORS
ALLOWED_ORIGINS=http://localhost:3333,https://blockstar.fun
```

---

## Next Steps

1. **Set up Supabase**
   - Create new Supabase project
   - Run `SCHEMA.sql` in SQL editor
   - Copy credentials to `.env`

2. **Seed agent data**
   - Generate 500+ profiles
   - Create 100 marketplace listings

3. **Integrate x402**
   - Add payment verification in purchase flow
   - Add contract interaction for USDC transfers

4. **Connect CLI**
   - Point CLI to backend API
   - Test full flow: connect → search → buy → extract → payout

5. **Deploy**
   - Backend: Vercel, Railway, or self-hosted
   - CLI: npm package publish

---

## Development

```bash
npm run dev              # Watch + serve
npm run build            # Compile
npm start                # Run dist/
```

## Testing

(Add test suite)

```bash
npm test
npm run test:watch
```
