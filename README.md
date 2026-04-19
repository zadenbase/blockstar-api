# Blockstar Backend API

Express.js server for marketplace, authentication, and extraction logic.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## API Endpoints

### Auth
- `POST /auth/verify` - Verify wallet signature, return session token
- `POST /auth/qr` - Generate QR code for CLI

### Marketplace
- `GET /marketplace/listings` - Search agents (paginated)
- `GET /marketplace/agents/:id` - Get agent details

### Purchases
- `POST /purchases` - Buy agent (requires x402 payment)
- `GET /purchases/pending` - Get pending extractions
- `GET /purchases/history` - Get past extractions

### Extraction
- `POST /extractions/:id/initiate` - Mark extraction as started

### Balance
- `GET /users/:wallet/balance` - Get user balance
- `GET /users/:wallet/balance-history` - Get transactions

### Payouts
- `POST /payouts/request` - Request withdrawal
- `GET /payouts/:id/status` - Check payout status

## Database

Supabase schema defined in SPEC.md. Initialize with:

```sql
-- See blockstar-cli/SPEC.md for full schema
```

## Key Responsibilities

1. **Auth**: Verify wallet signatures, issue session tokens
2. **Marketplace**: Manage agent listings, keep 100 active
3. **Purchases**: Handle USDC payments, create purchase records
4. **Extraction**: Log extraction results, credit balances
5. **Payouts**: Queue and process withdrawal requests

## x402 Integration

Integrate x402 protocol for USDC payments. See:
- https://x402.dev/docs
- Clawconnect spec for contract addresses

## Security

- Rate limit all endpoints
- Validate wallet signatures
- Verify USDC contracts
- Clear sessions on logout
- Log all transactions (audit trail)

## Development

```bash
npm run dev              # Watch + serve
npm run build            # Compile
npm run lint             # Check code quality
```

## Deployment

Deploy to Vercel, Railway, or self-hosted.

```bash
vercel deploy
# or
railway up
```

See DEPLOYMENT.md for details.
