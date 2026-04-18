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

#### `POST /extractions/:id/initiate`
Start extraction and generate reward.

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
    "reward": 4.37,
    "status": "completed"
  }
}
```

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
Get transaction history (requires auth).

```bash
curl "http://localhost:3000/users/0x1234.../balance-history?limit=20" \
  -H "Authorization: Bearer <token>"
```

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
