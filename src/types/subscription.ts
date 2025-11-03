export type RenewalStrategyKey = 
  | 'MONTHLY' 
  | 'EVERY_N_DAYS';

export type SubscriptionStatus = 'active' | 'paused' | 'completed' | 'overdue' | 'canceled' | 'archived';

export type SubscriptionEventType = 
  | 'created'
  | 'renewed'
  | 'custom_date_set'
  | 'custom_date_cleared'
  | 'completed'
  | 'overdue'
  | 'reverted'
  | 'updated'
  | 'archived';

export interface ServiceConfig {
  id: string;
  name: string;
  sku: string;
  logoUrl?: string;
  intervalDays?: number;
  serviceDurationDays?: number;
}

export interface Subscription {
  id: string;
  serviceId: string;
  clientId: string;
  saleId?: string;
  
  // Timestamps
  startedAt: string;
  currentCycleStartAt: string;
  lastRenewalAt?: string;
  nextRenewalAt?: string;
  customNextRenewalAt?: string; // Custom override for next renewal date
  targetEndAt?: string;
  
  // Counters
  iterationsDone?: number;
  
  // Config snapshot (portable from service)
  strategy: RenewalStrategyKey;
  intervalDays?: number;
  
  // State
  status: SubscriptionStatus;
  notes?: string;
  
  // Resource pool linking
  resourcePoolId?: string;
  resourcePoolSeatId?: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionEvent {
  id: string;
  subscriptionId: string;
  type: SubscriptionEventType;
  at: string;
  meta?: Record<string, any>;
  createdAt: string;
}

export interface StrategyHandler {
  computeNextRenewal(sub: Subscription): Date | null;
  computeNextRenewalWithoutCustom(sub: Subscription): Date | null;
  onRenew?(sub: Subscription): Partial<Subscription>;
}

export interface DueBuckets {
  dueToday: number;
  dueIn3Days: number;
  overdue: number;
}

export interface CycleProgress {
  pct: number;
  msLeft: number;
  msTotal: number;
}
