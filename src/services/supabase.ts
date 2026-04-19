import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { AgentProfile, Purchase, User, BalanceLedger, PayoutRequest, PayoutStatus } from '../types';

class SupabaseService {
  private client: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
    }

    this.client = createClient(url, key);
  }

  // ==== Agents ====
  async getAgentProfile(id: string): Promise<AgentProfile | null> {
    const { data, error } = await this.client
      .from('agent_profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async getMarketplaceListings(
    page: number = 1,
    limit: number = 10,
    filters?: { riskTier?: string; region?: string }
  ): Promise<{ listings: any[]; agents: AgentProfile[]; total: number }> {
    let query = this.client
      .from('marketplace_listings')
      .select('*', { count: 'exact' })
      .eq('status', 'active')
      .order('listed_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    const { data: listings, count, error } = await query;

    if (error) throw error;

    // Get agent profiles
    const agentIds = (listings || []).map((l) => l.agent_profile_id);
    const { data: agents } = await this.client
      .from('agent_profiles')
      .select('*')
      .in('id', agentIds);

    return {
      listings: listings || [],
      agents: agents || [],
      total: count || 0
    };
  }

  async getAllAgents(): Promise<AgentProfile[]> {
    const { data, error } = await this.client
      .from('agent_profiles')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  // ==== Marketplace ====
  async getActiveListings(): Promise<any[]> {
    const { data, error } = await this.client
      .from('marketplace_listings')
      .select('*')
      .eq('status', 'active');

    if (error) throw error;
    return data || [];
  }

  async createListing(agentProfileId: string): Promise<any> {
    const { data, error } = await this.client
      .from('marketplace_listings')
      .insert({
        agent_profile_id: agentProfileId,
        listed_at: new Date().toISOString(),
        status: 'active'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async removeListing(listingId: string): Promise<void> {
    const { error } = await this.client
      .from('marketplace_listings')
      .update({ status: 'sold' })
      .eq('id', listingId);

    if (error) throw error;
  }

  async getInactiveProfiles(limit: number): Promise<AgentProfile[]> {
    const { data, error } = await this.client
      .from('agent_profiles')
      .select('*')
      .not(
        'id',
        'in',
        `(${(
          await this.client
            .from('marketplace_listings')
            .select('agent_profile_id')
            .eq('status', 'active')
        ).data?.map((l) => l.agent_profile_id).join(',') || ''})`
      )
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  // ==== Purchases ====
  async createPurchase(
    userId: string,
    agentProfileId: string,
    price: number,
    extractionDuration: number
  ): Promise<Purchase> {
    const now = new Date();
    const endTime = new Date(now.getTime() + extractionDuration * 60 * 60 * 1000);

    const { data, error } = await this.client
      .from('purchases')
      .insert({
        user_id: userId,
        agent_profile_id: agentProfileId,
        purchased_at: now.toISOString(),
        purchase_price: price,
        extraction_start_time: now.toISOString(),
        extraction_end_time: endTime.toISOString(),
        status: 'purchased'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getPendingPurchases(userId: string): Promise<Purchase[]> {
    const { data, error } = await this.client
      .from('purchases')
      .select('*')
      .eq('user_id', userId.toLowerCase())
      .eq('status', 'purchased')
      .order('purchased_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getPurchaseHistory(userId: string, limit: number = 20): Promise<Purchase[]> {
    const { data, error } = await this.client
      .from('purchases')
      .select('*')
      .eq('user_id', userId.toLowerCase())
      .order('purchased_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  async updatePurchase(purchaseId: string, updates: Partial<Purchase>): Promise<Purchase> {
    const { data, error } = await this.client
      .from('purchases')
      .update(updates)
      .eq('id', purchaseId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ==== Users ====
  async getOrCreateUser(walletAddress: string): Promise<User> {
    const { data: existing, error: selectError } = await this.client
      .from('users')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();

    if (!selectError && existing) {
      // Update last activity
      await this.client
        .from('users')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('wallet_address', walletAddress);

      return existing;
    }

    // Create new user
    const now = new Date();
    const { data, error } = await this.client
      .from('users')
      .insert({
        wallet_address: walletAddress,
        total_balance: 0,
        first_activity_at: now.toISOString(),
        last_activity_at: now.toISOString(),
        updated_at: now.toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getUserBalance(walletAddress: string): Promise<User | null> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async addBalance(walletAddress: string, amount: number, transactionType: string, purchaseId?: string): Promise<void> {
    // Insert ledger entry
    await this.client
      .from('balance_ledger')
      .insert({
        user_id: walletAddress,
        amount,
        transaction_type: transactionType,
        related_purchase_id: purchaseId,
        created_at: new Date().toISOString()
      });

    // Update user balance
    const user = await this.getUserBalance(walletAddress);
    if (user) {
      await this.client
        .from('users')
        .update({
          total_balance: user.totalBalance + amount,
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('wallet_address', walletAddress);

      // Check if 30 days passed
      const daysSince = Math.floor((Date.now() - new Date(user.firstActivityAt).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince >= 30 && !user.payoutEligibleAt) {
        await this.client
          .from('users')
          .update({ payout_eligible_at: new Date().toISOString() })
          .eq('wallet_address', walletAddress);
      }
    }
  }

  async getBalanceHistory(walletAddress: string, limit: number = 20): Promise<(BalanceLedger & { parsedMetadata?: any })[]> {
    const { data, error } = await this.client
      .from('balance_ledger')
      .select('*')
      .eq('user_id', walletAddress)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    
    // Parse metadata JSON for each entry
    return (data || []).map((entry: any) => ({
      ...entry,
      parsedMetadata: entry.metadata ? JSON.parse(entry.metadata) : null
    }));
  }

  // ==== Payouts ====
  async createPayoutRequest(walletAddress: string, amount: number, daysSince: number): Promise<PayoutRequest> {
    const { data, error } = await this.client
      .from('payout_requests')
      .insert({
        user_id: walletAddress,
        amount_requested: amount,
        status: 'pending',
        requested_at: new Date().toISOString(),
        user_activity_days: daysSince
      })
      .select()
      .single();

    if (error) throw error;

    // Deduct from balance
    await this.addBalance(walletAddress, -amount, 'payout', data.id);

    return data;
  }

  async getPayoutStatus(payoutId: string): Promise<PayoutRequest | null> {
    const { data, error } = await this.client
      .from('payout_requests')
      .select('*')
      .eq('id', payoutId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async getPayoutHistory(walletAddress: string): Promise<PayoutRequest[]> {
    const { data, error } = await this.client
      .from('payout_requests')
      .select('*')
      .eq('user_id', walletAddress.toLowerCase())
      .order('requested_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((row: any) => ({
      ...row,
      amount: row.amount_requested ?? row.amount ?? 0,
      destination_wallet: row.destination_wallet ?? walletAddress,
      notes: row.notes ?? null,
      created_at: row.requested_at ?? row.created_at,
    }));
  }

  async updatePayoutStatus(payoutId: string, status: PayoutStatus, txHash?: string): Promise<PayoutRequest> {
    const { data, error } = await this.client
      .from('payout_requests')
      .update({
        status,
        processed_at: new Date().toISOString(),
        tx_hash: txHash
      })
      .eq('id', payoutId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ==== Admin ====
  async getAllUsers(): Promise<User[]> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .order('total_balance', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async setBalance(walletAddress: string, newBalance: number): Promise<User> {
    const { data, error } = await this.client
      .from('users')
      .upsert({
        wallet_address: walletAddress.toLowerCase(),
        total_balance: newBalance,
        last_activity_at: new Date().toISOString(),
      }, { onConflict: 'wallet_address' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async creditBalance(
    walletAddress: string, 
    amount: number, 
    transactionType?: string, 
    metadata?: { purchaseId?: string; agentProfileId?: string; agentName?: string; agentId?: string; agentRiskTier?: string; direction?: string; entryPrice?: number; exitPrice?: number; leverage?: number; tier?: string; grade?: string; sessionId?: string; tradeDurationSec?: number; note?: string }
  ): Promise<{ previous: number; newBalance: number; amount: number; ledgerEntryId?: string }> {
    const wallet = walletAddress.toLowerCase();
    
    // Get current balance with explicit logging
    const { data: existing, error } = await this.client
      .from('users')
      .select('total_balance, wallet_address')
      .eq('wallet_address', wallet)
      .maybeSingle();
    
    if (error) {
      console.error(`[Supabase] Error fetching balance for ${wallet}: ${error.message}`);
      throw error;
    }
    
    const previous = Number(existing?.total_balance ?? 0);
    const newBalance = Math.round((previous + amount) * 10000) / 10000; // 4 decimal precision
    
    console.log(`[Supabase] creditBalance: wallet=${wallet}, previous=${previous}, amount=${amount}, newBalance=${newBalance}`);
    
    // Determine transaction type based on amount if not provided
    const txType = transactionType || (amount > 0 ? 'extraction' : amount < 0 ? 'purchase' : 'adjustment');
    
    // Insert into balance ledger with metadata
    const ledgerData: any = {
      user_id: wallet,
      amount: amount,
      transaction_type: txType,
      related_purchase_id: metadata?.purchaseId || null,
      created_at: new Date().toISOString()
    };
    
    // Add metadata as JSON if provided
    if (metadata) {
      ledgerData.metadata = JSON.stringify(metadata);
    }
    
    const { data: ledgerEntry, error: ledgerError } = await this.client
      .from('balance_ledger')
      .insert(ledgerData)
      .select()
      .single();
    
    if (ledgerError) {
      console.error(`[Supabase] Failed to create ledger entry: ${ledgerError.message}`);
    } else {
      console.log(`[Supabase] Ledger entry created: ${ledgerEntry?.id}, type=${txType}`);
    }
    
    await this.setBalance(walletAddress, newBalance);
    
    // Verify the update
    const { data: verify } = await this.client
      .from('users')
      .select('total_balance')
      .eq('wallet_address', wallet)
      .single();
    
    const verifiedBalance = Number(verify?.total_balance ?? newBalance);
    
    return { 
      previous, 
      newBalance: verifiedBalance, 
      amount, 
      ledgerEntryId: ledgerEntry?.id 
    };
  }
}

export const supabase = new SupabaseService();
