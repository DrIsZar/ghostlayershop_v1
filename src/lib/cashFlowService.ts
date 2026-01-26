import { supabase, Transaction, Service } from './supabase';
import { subscriptionService } from './subscriptionService';
import { Subscription } from '../types/subscription';
import {
    MoneyPool,
    MoneyPoolWithStatus,
    PoolTransfer,
    DailyAdSpend,
    PendingPayout,
    TodaysNumbers,
    DailyPulse,
    WeeklyPulse,
    DecisionZone,
    UpcomingMoneyItem,
    PoolStatus,
    DecisionZoneStatus,
    MoneyPoolName
} from '../types/cashflow';

// ============================================
// Money Pools Operations
// ============================================

export async function getMoneyPools(): Promise<MoneyPoolWithStatus[]> {
    const { data, error } = await supabase
        .from('money_pools')
        .select('*')
        .order('name');

    if (error) throw error;

    const pools = (data || []) as MoneyPool[];

    return pools.map(pool => {
        const deficit = Math.max(0, pool.target - pool.balance);
        let status: PoolStatus = 'green';

        if (pool.balance <= 0) {
            status = 'red';
        } else if (pool.balance < pool.target * 0.5) {
            status = 'red';
        } else if (pool.balance < pool.target) {
            status = 'yellow';
        }

        return {
            ...pool,
            status,
            deficit
        };
    });
}

export async function updatePoolBalance(poolName: MoneyPoolName, newBalance: number): Promise<void> {
    const { error } = await supabase
        .from('money_pools')
        .update({ balance: newBalance })
        .eq('name', poolName);

    if (error) throw error;
}

export async function updatePoolTarget(poolName: MoneyPoolName, newTarget: number): Promise<void> {
    const { error } = await supabase
        .from('money_pools')
        .update({ target: newTarget })
        .eq('name', poolName);

    if (error) throw error;
}

export async function transferBetweenPools(
    fromPool: MoneyPoolName | 'external',
    toPool: MoneyPoolName | 'external',
    amount: number,
    notes?: string
): Promise<void> {
    // Get current balances
    const pools = await getMoneyPools();

    // Update from pool (if not external)
    if (fromPool !== 'external') {
        const from = pools.find(p => p.name === fromPool);
        if (!from) throw new Error(`Pool ${fromPool} not found`);
        if (from.balance < amount) throw new Error('Insufficient balance');
        await updatePoolBalance(fromPool, from.balance - amount);
    }

    // Update to pool (if not external)
    if (toPool !== 'external') {
        const to = pools.find(p => p.name === toPool);
        if (!to) throw new Error(`Pool ${toPool} not found`);
        await updatePoolBalance(toPool, to.balance + amount);
    }

    // Record the transfer
    const { error } = await supabase
        .from('pool_transfers')
        .insert({
            from_pool: fromPool,
            to_pool: toPool,
            amount,
            notes
        });

    if (error) throw error;
}

// ============================================
// Ad Spend Operations
// ============================================

export async function getTodaysAdSpend(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('daily_ad_spend')
        .select('amount')
        .eq('date', today);

    if (error) throw error;

    return (data || []).reduce((sum, item) => sum + Number(item.amount), 0);
}

export async function getAdSpendForDateRange(startDate: string, endDate: string): Promise<DailyAdSpend[]> {
    const { data, error } = await supabase
        .from('daily_ad_spend')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date');

    if (error) throw error;
    return (data || []) as DailyAdSpend[];
}

export async function addAdSpend(date: string, amount: number, platform: string, notes?: string): Promise<void> {
    const { error } = await supabase
        .from('daily_ad_spend')
        .upsert({
            date,
            amount,
            platform,
            notes
        }, {
            onConflict: 'date,platform'
        });

    if (error) throw error;
}

// ============================================
// Pending Payouts Operations
// ============================================

export async function getPendingPayouts(): Promise<PendingPayout[]> {
    const { data, error } = await supabase
        .from('pending_payouts')
        .select('*')
        .eq('received', false)
        .order('expected_date');

    if (error) throw error;
    return (data || []) as PendingPayout[];
}

export async function addPendingPayout(
    source: string,
    amount: number,
    expectedDate: string,
    notes?: string
): Promise<void> {
    const { error } = await supabase
        .from('pending_payouts')
        .insert({
            source,
            amount,
            expected_date: expectedDate,
            notes
        });

    if (error) throw error;
}

export async function markPayoutReceived(payoutId: string): Promise<void> {
    const { error } = await supabase
        .from('pending_payouts')
        .update({
            received: true,
            received_at: new Date().toISOString()
        })
        .eq('id', payoutId);

    if (error) throw error;
}

// ============================================
// Today's Numbers Calculation
// ============================================

export async function getTodaysNumbers(): Promise<TodaysNumbers> {
    const today = new Date().toISOString().split('T')[0];

    // Get today's transactions
    const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('date', today);

    if (txError) throw txError;

    const txList = (transactions || []) as Transaction[];

    const revenue = txList.reduce((sum, t) => sum + Number(t.selling_price), 0);
    const cogs = txList.reduce((sum, t) => sum + Number(t.cost_at_sale), 0);
    const salesCount = txList.length;

    // Get today's ad spend
    const adSpend = await getTodaysAdSpend();

    // Get pending payouts
    const pendingPayouts = await getPendingPayouts();
    const totalPending = pendingPayouts.reduce((sum, p) => sum + Number(p.amount), 0);

    // Days until next payout
    let pendingPayoutDays: number | null = null;
    if (pendingPayouts.length > 0) {
        const nextPayout = new Date(pendingPayouts[0].expected_date);
        const now = new Date();
        const diffTime = nextPayout.getTime() - now.getTime();
        pendingPayoutDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (pendingPayoutDays < 0) pendingPayoutDays = 0;
    }

    const netProfit = revenue - cogs - adSpend;

    return {
        revenue,
        salesCount,
        adSpend,
        cogs,
        netProfit,
        pendingPayouts: totalPending,
        pendingPayoutDays
    };
}

// ============================================
// Weekly Pulse Calculation
// ============================================

function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

function getDayName(date: Date): string {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
}

export async function getWeeklyPulse(): Promise<WeeklyPulse> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get start of current week (Sunday)
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    // Get start of last week
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const lastWeekEnd = new Date(weekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);

    // Get transactions for this week
    const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .gte('date', formatDate(weekStart))
        .lte('date', formatDate(today));

    if (txError) throw txError;

    // Get ad spend for this week
    const adSpendData = await getAdSpendForDateRange(formatDate(weekStart), formatDate(today));

    // Calculate daily profits
    const days: DailyPulse[] = [];
    let weekTotal = 0;

    for (let i = 0; i <= today.getDay(); i++) {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + i);
        const dateStr = formatDate(day);

        const dayTransactions = (transactions || []).filter(t => t.date === dateStr) as Transaction[];
        const dayRevenue = dayTransactions.reduce((sum, t) => sum + Number(t.selling_price), 0);
        const dayCogs = dayTransactions.reduce((sum, t) => sum + Number(t.cost_at_sale), 0);
        const dayAdSpend = adSpendData
            .filter(a => a.date === dateStr)
            .reduce((sum, a) => sum + Number(a.amount), 0);

        const netProfit = dayRevenue - dayCogs - dayAdSpend;
        weekTotal += netProfit;

        days.push({
            date: dateStr,
            dayName: getDayName(day),
            netProfit,
            isToday: dateStr === formatDate(today)
        });
    }

    // Get last week's total for comparison
    const { data: lastWeekTx, error: lwError } = await supabase
        .from('transactions')
        .select('*')
        .gte('date', formatDate(lastWeekStart))
        .lte('date', formatDate(lastWeekEnd));

    if (lwError) throw lwError;

    const lastWeekAdSpend = await getAdSpendForDateRange(
        formatDate(lastWeekStart),
        formatDate(lastWeekEnd)
    );

    const lastWeekRevenue = (lastWeekTx || []).reduce((sum, t) => sum + Number(t.selling_price), 0);
    const lastWeekCogs = (lastWeekTx || []).reduce((sum, t) => sum + Number(t.cost_at_sale), 0);
    const lastWeekAds = lastWeekAdSpend.reduce((sum, a) => sum + Number(a.amount), 0);
    const lastWeekTotal = lastWeekRevenue - lastWeekCogs - lastWeekAds;

    // Calculate vs last week percentage
    let vsLastWeek = 0;
    if (lastWeekTotal !== 0) {
        vsLastWeek = Math.round(((weekTotal - lastWeekTotal) / Math.abs(lastWeekTotal)) * 100);
    }

    // Weekly target (configurable - using 350 as default)
    const weekTarget = 350;
    const percentAchieved = Math.round((weekTotal / weekTarget) * 100);

    return {
        days,
        weekTotal,
        weekTarget,
        percentAchieved,
        vsLastWeek
    };
}

// ============================================
// Decision Zone Calculation
// ============================================

export async function getDecisionZone(
    todaysNumbers: TodaysNumbers,
    pools: MoneyPoolWithStatus[],
    weeklyPulse: WeeklyPulse
): Promise<DecisionZone> {
    const businessVault = pools.find(p => p.name === 'business_vault');
    const businessBalance = businessVault?.balance || 0;

    // Determine status
    let status: DecisionZoneStatus = 'green';
    let headline = '';
    let description = '';
    const suggestedActions: string[] = [];

    // Red conditions
    if (businessBalance < 200 || todaysNumbers.netProfit < -50) {
        status = 'red';
        headline = '🔴 CASH TIGHT';

        if (businessBalance < 200) {
            description = `Business Vault at $${businessBalance.toFixed(0)} - below $200 safety threshold.`;
            suggestedActions.push('Reduce ad spend by 50% immediately');
            suggestedActions.push('Move funds from Savings to Business Vault');
        } else {
            description = `Today's loss of $${Math.abs(todaysNumbers.netProfit).toFixed(0)} is significant.`;
            suggestedActions.push('Pause low-performing ad campaigns');
            suggestedActions.push('Review cost structure on recent sales');
        }
    }
    // Yellow conditions
    else if (
        todaysNumbers.netProfit < 50 ||
        weeklyPulse.percentAchieved < 60 ||
        businessBalance < 500
    ) {
        status = 'yellow';
        headline = '⚠️ MONITOR CLOSELY';

        if (todaysNumbers.netProfit < 50 && todaysNumbers.netProfit >= 0) {
            description = `Today's profit is $${todaysNumbers.netProfit.toFixed(0)} - below your $50 target.`;
            suggestedActions.push('Keep ad spend steady - don\'t increase');
        } else if (weeklyPulse.percentAchieved < 60) {
            description = `Week is ${weeklyPulse.percentAchieved}% to target - need stronger finish.`;
            suggestedActions.push('Focus on closing pending renewals');
        } else {
            description = `Business Vault at $${businessBalance.toFixed(0)} - build it up to $500+.`;
            suggestedActions.push('Move surplus from today\'s profit to Business Vault');
        }

        if (todaysNumbers.pendingPayouts > 0) {
            suggestedActions.push(
                `$${todaysNumbers.pendingPayouts.toFixed(0)} payout arriving in ${todaysNumbers.pendingPayoutDays} day(s)`
            );
        }
    }
    // Green conditions
    else {
        status = 'green';
        headline = '✅ ON TRACK';

        const surplus = todaysNumbers.netProfit - todaysNumbers.adSpend;
        if (surplus > 0) {
            description = `Today's profit covered ad spend with $${surplus.toFixed(0)} surplus.`;
        } else {
            description = `Profitable day with $${todaysNumbers.netProfit.toFixed(0)} net.`;
        }

        const savings = pools.find(p => p.name === 'savings');
        if (savings && savings.status !== 'green') {
            suggestedActions.push(`Add $${Math.min(50, todaysNumbers.netProfit * 0.2).toFixed(0)} to Savings`);
        }

        if (todaysNumbers.netProfit > 100) {
            suggestedActions.push('Consider 10% ad budget increase tomorrow');
        }

        if (suggestedActions.length === 0) {
            suggestedActions.push('Stay the course - you\'re doing great!');
        }
    }

    return {
        status,
        headline,
        description,
        suggestedActions
    };
}

// ============================================
// Upcoming Money (7-day lookahead)
// ============================================

export async function getUpcomingMoney(): Promise<UpcomingMoneyItem[]> {
    const today = new Date();
    const weekLater = new Date(today);
    weekLater.setDate(weekLater.getDate() + 7);

    const items: UpcomingMoneyItem[] = [];

    // Get pending payouts in the next 7 days
    const payouts = await getPendingPayouts();
    for (const payout of payouts) {
        const payoutDate = new Date(payout.expected_date);
        if (payoutDate <= weekLater) {
            items.push({
                date: payout.expected_date,
                type: 'payout',
                source: payout.source,
                amount: payout.amount
            });
        }
    }

    // Get subscription renewals in the next 7 days
    const subscriptions = await subscriptionService.listSubscriptions();
    const { data: services } = await supabase.from('services').select('*');
    const { data: clients } = await supabase.from('clients').select('id, name');

    const serviceMap = new Map((services || []).map(s => [s.id, s]));
    const clientMap = new Map((clients || []).map(c => [c.id, c]));

    const activeSubscriptions = subscriptions.filter(
        (sub: Subscription) => (sub.status === 'active' || sub.status === 'overdue') && sub.nextRenewalAt
    );

    for (const sub of activeSubscriptions) {
        if (!sub.nextRenewalAt) continue;
        const renewalDate = new Date(sub.nextRenewalAt);
        if (renewalDate >= today && renewalDate <= weekLater) {
            const service = serviceMap.get(sub.serviceId) as Service | undefined;
            const client = clientMap.get(sub.clientId);

            items.push({
                date: sub.nextRenewalAt.split('T')[0],
                type: 'renewal',
                source: service?.product_service || 'Unknown Service',
                amount: service?.selling_price || 0,
                clientName: client?.name
            });
        }
    }

    // Sort by date
    items.sort((a, b) => a.date.localeCompare(b.date));

    return items;
}

// ============================================
// Export as service object
// ============================================

export const cashFlowService = {
    // Pool operations
    getMoneyPools,
    updatePoolBalance,
    updatePoolTarget,
    transferBetweenPools,

    // Ad spend operations
    getTodaysAdSpend,
    getAdSpendForDateRange,
    addAdSpend,

    // Payout operations
    getPendingPayouts,
    addPendingPayout,
    markPayoutReceived,

    // Calculated data
    getTodaysNumbers,
    getWeeklyPulse,
    getDecisionZone,
    getUpcomingMoney
};
