import type { AgentProfile, Purchase, User, BalanceLedger, PayoutRequest, PayoutStatus } from '../types';
declare class SupabaseService {
    private client;
    constructor();
    getAgentProfile(id: string): Promise<AgentProfile | null>;
    getMarketplaceListings(page?: number, limit?: number, filters?: {
        riskTier?: string;
        region?: string;
    }): Promise<{
        listings: any[];
        agents: AgentProfile[];
        total: number;
    }>;
    getAllAgents(): Promise<AgentProfile[]>;
    getActiveListings(): Promise<any[]>;
    createListing(agentProfileId: string): Promise<any>;
    removeListing(listingId: string): Promise<void>;
    getInactiveProfiles(limit: number): Promise<AgentProfile[]>;
    createPurchase(userId: string, agentProfileId: string, price: number, extractionDuration: number): Promise<Purchase>;
    getPendingPurchases(userId: string): Promise<Purchase[]>;
    getPurchaseHistory(userId: string, limit?: number): Promise<Purchase[]>;
    updatePurchase(purchaseId: string, updates: Partial<Purchase>): Promise<Purchase>;
    getOrCreateUser(walletAddress: string): Promise<User>;
    getUserBalance(walletAddress: string): Promise<User | null>;
    addBalance(walletAddress: string, amount: number, transactionType: string, purchaseId?: string): Promise<void>;
    getBalanceHistory(walletAddress: string, limit?: number): Promise<BalanceLedger[]>;
    createPayoutRequest(walletAddress: string, amount: number, daysSince: number): Promise<PayoutRequest>;
    getPayoutStatus(payoutId: string): Promise<PayoutRequest | null>;
    getPayoutHistory(walletAddress: string): Promise<PayoutRequest[]>;
    updatePayoutStatus(payoutId: string, status: PayoutStatus, txHash?: string): Promise<PayoutRequest>;
}
export declare const supabase: SupabaseService;
export {};
