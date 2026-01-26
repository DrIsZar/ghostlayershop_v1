// Types for the redesigned cashflow page

export type MoneyPoolName = 'business_vault' | 'savings' | 'personal';

export interface MoneyPool {
    id: string;
    name: MoneyPoolName;
    display_name: string;
    balance: number;
    target: number;
    created_at: string;
    updated_at: string;
}

export interface PoolTransfer {
    id: string;
    from_pool: MoneyPoolName | 'external';
    to_pool: MoneyPoolName | 'external';
    amount: number;
    notes?: string;
    created_at: string;
}

export interface DailyAdSpend {
    id: string;
    date: string;
    amount: number;
    platform: string;
    notes?: string;
    created_at: string;
    updated_at: string;
}

export interface PendingPayout {
    id: string;
    source: string;
    amount: number;
    expected_date: string;
    received: boolean;
    received_at?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
}

// Derived types for UI display

export type PoolStatus = 'green' | 'yellow' | 'red';

export interface MoneyPoolWithStatus extends MoneyPool {
    status: PoolStatus;
    deficit: number; // How much below target (0 if at or above)
}

export interface TodaysNumbers {
    revenue: number;
    salesCount: number;
    adSpend: number;
    cogs: number; // Cost of goods sold
    netProfit: number;
    pendingPayouts: number;
    pendingPayoutDays: number | null; // Days until next payout
}

export interface DailyPulse {
    date: string;
    dayName: string;
    netProfit: number;
    isToday: boolean;
}

export interface WeeklyPulse {
    days: DailyPulse[];
    weekTotal: number;
    weekTarget: number;
    percentAchieved: number;
    vsLastWeek: number; // Percentage change (+/-)
}

export type DecisionZoneStatus = 'green' | 'yellow' | 'red';

export interface DecisionZone {
    status: DecisionZoneStatus;
    headline: string;
    description: string;
    suggestedActions: string[];
}

export interface UpcomingMoneyItem {
    date: string;
    type: 'renewal' | 'payout' | 'estimate';
    source: string;
    amount: number;
    clientName?: string;
}
