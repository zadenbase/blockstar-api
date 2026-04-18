-- Blockstar Backend Database Schema
-- Run this in Supabase SQL editor

-- Agent Profiles
CREATE TABLE agent_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  risk_tier VARCHAR(20) NOT NULL DEFAULT 'medium',
  trading_style VARCHAR(255),
  region VARCHAR(20) NOT NULL DEFAULT 'APAC',
  volatility_mod DECIMAL(3,2) DEFAULT 1.0,
  historical_roi DECIMAL(5,2),
  dossier_summary TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  last_active_at TIMESTAMP,
  CONSTRAINT volatility_range CHECK (volatility_mod >= 0.8 AND volatility_mod <= 1.4)
);

-- Marketplace Listings (always 100 active)
CREATE TABLE marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_profile_id UUID NOT NULL REFERENCES agent_profiles(id) ON DELETE CASCADE,
  listed_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'active'
);

CREATE UNIQUE INDEX ON marketplace_listings(agent_profile_id) WHERE status='active';
CREATE INDEX ON marketplace_listings(status, listed_at DESC);

-- Users
CREATE TABLE users (
  wallet_address VARCHAR(255) PRIMARY KEY,
  total_balance DECIMAL(10,4) DEFAULT 0,
  first_activity_at TIMESTAMP DEFAULT NOW(),
  last_activity_at TIMESTAMP DEFAULT NOW(),
  payout_eligible_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ON users(total_balance DESC);

-- Purchases
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  agent_profile_id UUID NOT NULL REFERENCES agent_profiles(id),
  purchased_at TIMESTAMP DEFAULT NOW(),
  purchase_price DECIMAL(10,4) NOT NULL,
  extraction_start_time TIMESTAMP NOT NULL,
  extraction_end_time TIMESTAMP NOT NULL,
  extraction_initiated_at TIMESTAMP,
  extraction_completed_at TIMESTAMP,
  extracted_amount DECIMAL(10,4),
  status VARCHAR(20) DEFAULT 'purchased'
);

CREATE INDEX ON purchases(user_id, status);
CREATE INDEX ON purchases(extraction_end_time DESC);
CREATE INDEX ON purchases(status);

-- Balance Ledger
CREATE TABLE balance_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  amount DECIMAL(10,4) NOT NULL,
  transaction_type VARCHAR(20) NOT NULL,
  related_purchase_id UUID REFERENCES purchases(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ON balance_ledger(user_id, created_at DESC);
CREATE INDEX ON balance_ledger(transaction_type);

-- Payout Requests
CREATE TABLE payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  amount_requested DECIMAL(10,4) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  tx_hash VARCHAR(255),
  user_activity_days INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ON payout_requests(user_id, status);
CREATE INDEX ON payout_requests(status);
