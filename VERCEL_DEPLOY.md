# Deploy Blockstar API to Vercel

## Quick Deploy

### 1. Install Vercel CLI
```bash
npm i -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Deploy
```bash
cd ~/blockstar-api
vercel --prod
```

---

## Environment Variables

Set these in Vercel Dashboard (Project Settings → Environment Variables):

| Variable | Value | Required |
|----------|-------|----------|
| `SUPABASE_URL` | `https://zzakwwfdmgzcaobevsfa.supabase.co` | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIs...` | ✅ |
| `JWT_SECRET` | `blockstar-secret-2026` | ✅ |
| `ADMIN_SECRET` | `blockstar-admin-zaden-1776486209` | ✅ |
| `ALLOWED_ORIGINS` | `http://localhost:3333,https://blockstar.fun` | ✅ |
| `X402_CONTRACT_ADDRESS` | `0x1234567890123456789012345678901234567890` | ❌ |
| `USDC_CONTRACT_ADDRESS` | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | ❌ |
| `NODE_ENV` | `production` | ✅ |

---

## Project Structure for Vercel

```
blockstar-api/
├── api/
│   └── index.ts          # Vercel serverless entry point
├── src/
│   ├── server.ts         # Express app (shared)
│   └── routes/           # All routes
├── vercel.json           # Vercel config
└── package.json
```

---

## API Endpoints

Once deployed, your API will be at:
```
https://your-project.vercel.app
```

Test it:
```bash
curl https://your-project.vercel.app/health
```

---

## Important Notes

### ⚠️ Serverless Limitations

1. **In-Memory Cache**: The cache service works but resets on each cold start
   - Use Redis or Upstash for persistent caching in production

2. **Background Jobs**: No persistent background processes
   - Cache cleanup won't run (not needed for serverless)

3. **WebSockets**: Not supported on Vercel
   - Use Server-Sent Events or polling instead

### 🔧 Rate Limiting

Vercel has built-in rate limiting. The app's rate limiter adds extra protection.

### 🔄 Cold Starts

Serverless functions have cold starts (~100-500ms).
- Keep dependencies minimal
- Use `@vercel/node` runtime

---

## Custom Domain

1. In Vercel Dashboard → Domains
2. Add `api.blockstar.fun` or your domain
3. Update DNS records as instructed

---

## Monitoring

Vercel provides:
- Function logs (real-time)
- Analytics
- Error tracking

View logs:
```bash
vercel logs --json
```

---

## Switching from Fly.io to Vercel

1. Deploy to Vercel (above)
2. Test all endpoints
3. Update frontend to use new Vercel URL
4. Destroy Fly.io app (optional):
   ```bash
   fly apps destroy blockstar-api --yes
   ```

---

## Troubleshooting

### Build Errors
```bash
# Test build locally
vercel build
```

### Environment Variables Not Loading
- Ensure they're set in Vercel Dashboard
- Redeploy after adding variables

### CORS Issues
- `vercel.json` already includes CORS headers
- Update `ALLOWED_ORIGINS` env var with your frontend URL

### 504 Timeout
- Vercel has 10s timeout on free tier
- 60s on Pro tier
- Optimize slow endpoints
