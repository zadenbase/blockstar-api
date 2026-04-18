"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}
const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const prefixes = ['XR', 'PHANTOM', 'NEURAL', 'APEX', 'ECHO', 'NEXUS', 'VOLT', 'CIPHER'];
const tradingStyles = [
    'micro-reversal',
    'sentiment-arbitrage',
    'momentum-capture',
    'volatility-harvesting',
    'order-flow-analysis',
    'statistical-arbitrage',
    'cross-exchange-arbitrage',
    'signal-correlation'
];
const regions = ['APAC', 'EU', 'AMERICAS'];
const details = [
    'Known for rapid position rotation and high-frequency executions.',
    'Excels in low-liquidity market conditions with proprietary footprint analysis.',
    'Correlates sentiment data with microstructure signals for edge extraction.',
    'Adapts strategy to volatile market regimes with dynamic position sizing.',
    'Specializes in information-asymmetry exploitation across regional markets.',
    'Uses advanced time-series analysis for predictive market modeling.'
];
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomFloat(min, max) {
    return Math.random() * (max - min) + min;
}
function generateAgentName() {
    const prefix = prefixes[randomInt(0, prefixes.length - 1)];
    const number = String(randomInt(1000, 9999));
    return `${prefix}-${number}`;
}
function generateAgent() {
    const rand = Math.random();
    let riskTier;
    let volMod;
    let roi;
    if (rand < 0.3) {
        riskTier = 'low';
        volMod = randomFloat(0.8, 0.95);
        roi = randomFloat(2, 8);
    }
    else if (rand < 0.7) {
        riskTier = 'medium';
        volMod = randomFloat(0.95, 1.05);
        roi = randomFloat(5, 15);
    }
    else if (rand < 0.95) {
        riskTier = 'high';
        volMod = randomFloat(1.05, 1.2);
        roi = randomFloat(10, 30);
    }
    else {
        riskTier = 'extreme';
        volMod = randomFloat(1.2, 1.4);
        roi = randomFloat(15, 50);
    }
    const tradingStyle = tradingStyles[randomInt(0, tradingStyles.length - 1)];
    const region = regions[randomInt(0, regions.length - 1)];
    const detail = details[randomInt(0, details.length - 1)];
    const dossierSummary = `Specializes in ${tradingStyle} across ${region}. Historical ${roi.toFixed(1)}% ROI with ${volMod.toFixed(2)}x volatility modifier. ${detail}`;
    return {
        name: generateAgentName(),
        risk_tier: riskTier,
        trading_style: tradingStyle,
        region: region,
        volatility_mod: parseFloat(volMod.toFixed(2)),
        historical_roi: parseFloat(roi.toFixed(1)),
        dossier_summary: dossierSummary
    };
}
async function seedAgents() {
    console.log('\n  🌱 Seeding Blockstar agents...\n');
    try {
        // Generate 500 unique agents
        const agents = [];
        const names = new Set();
        while (agents.length < 500) {
            const agent = generateAgent();
            // Ensure unique names
            if (!names.has(agent.name)) {
                agents.push(agent);
                names.add(agent.name);
            }
        }
        console.log(`  ✓ Generated ${agents.length} unique agents`);
        // Insert in batches of 50
        for (let i = 0; i < agents.length; i += 50) {
            const batch = agents.slice(i, i + 50);
            const { data, error } = await supabase
                .from('agent_profiles')
                .insert(batch)
                .select();
            if (error)
                throw error;
            console.log(`  ✓ Inserted batch ${Math.floor(i / 50) + 1}/10`);
        }
        // Get all agents
        const { data: allAgents, error: fetchError } = await supabase
            .from('agent_profiles')
            .select('id');
        if (fetchError)
            throw fetchError;
        console.log(`\n  ✓ Total agents in database: ${allAgents?.length || 0}`);
        // Create 100 marketplace listings (random selection from agents)
        console.log('\n  📍 Creating marketplace listings...\n');
        const listings = [];
        const shuffled = (allAgents || []).sort(() => Math.random() - 0.5);
        for (let i = 0; i < 100 && i < shuffled.length; i++) {
            listings.push({
                agent_profile_id: shuffled[i].id,
                status: 'active'
            });
        }
        // Insert listings in batches
        for (let i = 0; i < listings.length; i += 50) {
            const batch = listings.slice(i, i + 50);
            const { error } = await supabase
                .from('marketplace_listings')
                .insert(batch);
            if (error)
                throw error;
            console.log(`  ✓ Created batch ${Math.floor(i / 50) + 1}/${Math.ceil(listings.length / 50)}`);
        }
        console.log(`\n  ✓ Created ${listings.length} marketplace listings`);
        console.log('\n  ✅ Database seeding complete!\n');
        console.log(`  Summary:`);
        console.log(`  • Agents: ${agents.length}`);
        console.log(`  • Active listings: ${listings.length}`);
        console.log(`  • Risk distribution: 30% low, 40% medium, 25% high, 5% extreme`);
        console.log(`  • Region distribution: 35% APAC, 35% EU, 30% AMERICAS\n`);
        process.exit(0);
    }
    catch (error) {
        console.error('\n  ✗ Seeding failed:');
        console.error(error);
        process.exit(1);
    }
}
seedAgents();
//# sourceMappingURL=seed.js.map