// Blockstar API Type Definitions

export type RiskTier = 'low' | 'medium' | 'high' | 'extreme';
export type Region = 'APAC' | 'EU' | 'AMERICAS';
export type TransactionType = 'extraction' | 'purchase' | 'payout' | 'refund';
export type PurchaseStatus = 'purchased' | 'extracting' | 'completed' | 'forfeited';
export type PayoutStatus = 'pending' | 'approved' | 'sent' | 'rejected';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  riskTier: RiskTier;
  tradingStyle: string;
  region: Region;
  volatilityMod: number;
  historicalROI: number;
  dossierSummary: string;
  createdAt: string;
  lastActiveAt?: string;
}

export interface MarketplaceListing {
  id: string;
  agentProfileId: string;
  listedAt: string;
  expiresAt?: string;
  status: 'active' | 'sold' | 'archived';
}

export interface Purchase {
  id: string;
  userId: string;
  agentProfileId: string;
  purchasedAt: string;
  purchasePrice: number;
  extractionStartTime: string;
  extractionEndTime: string;
  extractionInitiatedAt?: string;
  extractionCompletedAt?: string;
  extractedAmount?: number;
  status: PurchaseStatus;
}

export interface User {
  walletAddress: string;
  totalBalance: number;
  firstActivityAt: string;
  lastActivityAt: string;
  payoutEligibleAt?: string;
  updatedAt: string;
}

export interface BalanceLedger {
  id: string;
  userId: string;
  amount: number;
  transactionType: TransactionType;
  relatedPurchaseId?: string;
  createdAt: string;
}

export interface PayoutRequest {
  id: string;
  userId: string;
  amountRequested: number;
  status: PayoutStatus;
  requestedAt: string;
  processedAt?: string;
  txHash?: string;
  userActivityDays: number;
}
