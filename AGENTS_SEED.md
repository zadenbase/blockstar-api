# Agent Seed Data Generator

Script to seed 500+ agent profiles into Supabase.

## Usage

```typescript
// Generate seed data
import { seedAgents } from './scripts/seed';
await seedAgents();
```

## Data Format

```typescript
interface AgentProfile {
  name: string;           // e.g., "XR-7249", "PHANTOM-TRADE-01"
  riskTier: RiskTier;     // low | medium | high | extreme
  tradingStyle: string;   // e.g., "micro-reversal", "sentiment-arbitrage"
  region: Region;         // APAC | EU | AMERICAS
  volatilityMod: number;  // 0.8–1.4
  historicalROI: number;  // percentage, e.g., 4.2
  dossierSummary: string; // 2-3 sentences
}
```

## Distribution Strategy

### Risk Tier
- **30%** low risk (volatility mod: 0.8–0.95, ROI: 2–8%)
- **40%** medium risk (volatility mod: 0.95–1.05, ROI: 5–15%)
- **25%** high risk (volatility mod: 1.05–1.2, ROI: 10–30%)
- **5%** extreme risk (volatility mod: 1.2–1.4, ROI: 15–50%)

### Region
- **35%** APAC
- **35%** EU
- **30%** AMERICAS

### Trading Style (randomized)
- Micro-reversal
- Sentiment-arbitrage
- Momentum-capture
- Volatility-harvesting
- Order-flow analysis
- Statistical arbitrage
- Cross-exchange arbitrage
- Signal-correlation trading

## Names

Format: `{PREFIX}-{RANDOM_4DIGITS}`

Prefixes (randomized):
- XR (Xenoglyph Routed)
- PHANTOM (Phantom Protocol)
- NEURAL (Neural Trade)
- APEX (Apex Algorithm)
- ECHO (Echo Signal)
- NEXUS (Nexus Intelligence)
- VOLT (Volt Protocol)
- CIPHER (Cipher Analysis)

## Dossier Summaries

Templates (randomized parameters):
- "Specializes in {STYLE} across {REGION}. Historical {ROI}% ROI with {VOLATILITY}x volatility modifier. {DETAIL}."
- "Advanced {STYLE} agent. Operates primarily in {REGION} markets with consistent {ROI}% returns. {DETAIL}."
- "{STYLE}-focused trader. {VOLATILITY}x volatility profile, {ROI}% lifetime performance. {DETAIL}."

Details (randomized):
- "Known for rapid position rotation and high-frequency executions."
- "Excels in low-liquidity market conditions with proprietary footprint analysis."
- "Correlates sentiment data with microstructure signals for edge extraction."
- "Adapts strategy to volatile market regimes with dynamic position sizing."

## Example

```javascript
{
  name: "XR-4829",
  riskTier: "high",
  tradingStyle: "sentiment-arbitrage",
  region: "APAC",
  volatilityMod: 1.15,
  historicalROI: 22.5,
  dossierSummary: "Specializes in sentiment-arbitrage across APAC. Historical 22.5% ROI with 1.15x volatility modifier. Correlates sentiment data with microstructure signals for edge extraction.",
  createdAt: "2026-04-17T00:00:00Z"
}
```

## Next Steps

1. Create `scripts/seed.ts` in backend
2. Generate 500+ profiles
3. Run: `ts-node scripts/seed.ts`
4. Verify in Supabase dashboard
5. Create marketplace listings (100 active)
