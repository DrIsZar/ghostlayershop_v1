import { Subscription } from '../types/subscription';
import { Transaction, Service } from './supabase';

export interface DailyProjection {
    date: string;
    subscriptionRevenue: number;
    oneTimeSalesEstimate: number;
    subscriptionCosts: number;
    oneTimeCostsEstimate: number;
    netCashFlow: number;
    cumulativeCashBalance: number;
    renewalCount: number;
    renewalDetails: Array<{
        clientName?: string;
        serviceName: string;
        amount: number;
    }>;
}

export interface CashFlowForecast {
    projections: DailyProjection[];
    summary: {
        startingBalance: number;
        endingBalance: number;
        totalProjectedRevenue: number;
        totalProjectedCosts: number;
        netCashFlow: number;
        averageDailyRevenue: number;
        averageDailyCosts: number;
        monthlyRecurringRevenue: number;
        cashRunwayDays: number | null;
        criticalDates: Array<{
            date: string;
            type: 'low_balance' | 'negative' | 'high_revenue';
            balance: number;
            description: string;
        }>;
    };
}

export interface ForecastOptions {
    days: number;
    startingCash?: number;
    includeOneTimeSales?: boolean;
    optimismFactor?: number; // 0.5 = pessimistic, 1.0 = realistic, 1.5 = optimistic
}

/**
 * Calculate current cash position from transaction history
 */
export function calculateCurrentCashPosition(transactions: Transaction[]): number {
    return transactions.reduce((total, t) => {
        const profit = t.selling_price - t.cost_at_sale;
        return total + profit;
    }, 0);
}

/**
 * Forecast revenue from active subscriptions
 */
export function forecastSubscriptionRevenue(
    subscriptions: Subscription[],
    services: Service[],
    clients: Array<{ id: string; name: string }>,
    startDate: Date,
    endDate: Date
): Map<string, DailyProjection['renewalDetails']> {
    const dailyRenewals = new Map<string, DailyProjection['renewalDetails']>();

    // Create service lookup map
    const serviceMap = new Map(services.map(s => [s.id, s]));
    const clientMap = new Map(clients.map(c => [c.id, c]));

    // Only process active subscriptions with future renewal dates
    const activeSubscriptions = subscriptions.filter(
        sub => (sub.status === 'active' || sub.status === 'overdue') && sub.nextRenewalAt
    );

    activeSubscriptions.forEach(sub => {
        const service = serviceMap.get(sub.serviceId);
        if (!service) return;

        let currentRenewalDate = new Date(sub.nextRenewalAt!);
        const intervalDays = sub.intervalDays || 30;

        // Project renewals within the forecast period
        while (currentRenewalDate <= endDate) {
            if (currentRenewalDate >= startDate) {
                const dateKey = currentRenewalDate.toISOString().split('T')[0];

                if (!dailyRenewals.has(dateKey)) {
                    dailyRenewals.set(dateKey, []);
                }

                const client = clientMap.get(sub.clientId);
                dailyRenewals.get(dateKey)!.push({
                    clientName: client?.name,
                    serviceName: service.product_service,
                    amount: service.selling_price
                });
            }

            // Move to next renewal
            currentRenewalDate.setDate(currentRenewalDate.getDate() + intervalDays);
        }
    });

    return dailyRenewals;
}

/**
 * Analyze historical sales patterns to estimate future one-time sales
 */
export function analyzeHistoricalSalesPatterns(transactions: Transaction[], days: number = 30) {
    const now = new Date();
    const lookbackDate = new Date(now);
    lookbackDate.setDate(lookbackDate.getDate() - days);

    const recentTransactions = transactions.filter(t => {
        const transDate = new Date(t.date);
        return transDate >= lookbackDate && transDate <= now;
    });

    if (recentTransactions.length === 0) {
        return {
            averageDailyRevenue: 0,
            averageDailyCosts: 0,
            averageDailyProfit: 0,
            averageDailyTransactions: 0,
            totalDays: days
        };
    }

    const totalRevenue = recentTransactions.reduce((sum, t) => sum + t.selling_price, 0);
    const totalCosts = recentTransactions.reduce((sum, t) => sum + t.cost_at_sale, 0);
    const totalProfit = totalRevenue - totalCosts;

    return {
        averageDailyRevenue: totalRevenue / days,
        averageDailyCosts: totalCosts / days,
        averageDailyProfit: totalProfit / days,
        averageDailyTransactions: recentTransactions.length / days,
        totalDays: days
    };
}

/**
 * Calculate Monthly Recurring Revenue (MRR)
 */
export function calculateMRR(
    subscriptions: Subscription[],
    services: Service[]
): number {
    const serviceMap = new Map(services.map(s => [s.id, s]));

    return subscriptions
        .filter(sub => sub.status === 'active' || sub.status === 'overdue')
        .reduce((total, sub) => {
            const service = serviceMap.get(sub.serviceId);
            if (!service) return total;

            const intervalDays = sub.intervalDays || 30;
            const monthlyRevenue = (service.selling_price / intervalDays) * 30;

            return total + monthlyRevenue;
        }, 0);
}

/**
 * Calculate cash runway (days until cash runs out)
 */
export function calculateCashRunway(
    currentCash: number,
    averageDailyCosts: number
): number | null {
    if (averageDailyCosts <= 0 || currentCash <= 0) return null;
    return Math.floor(currentCash / averageDailyCosts);
}

/**
 * Generate daily cash flow projections
 */
export function generateCashFlowForecast(
    transactions: Transaction[],
    subscriptions: Subscription[],
    services: Service[],
    clients: Array<{ id: string; name: string }>,
    options: ForecastOptions = { days: 90 }
): CashFlowForecast {
    const {
        days = 90,
        startingCash,
        includeOneTimeSales = true,
        optimismFactor = 1.0
    } = options;

    // Calculate starting balance
    const currentCash = startingCash ?? calculateCurrentCashPosition(transactions);

    // Analyze historical patterns
    const historicalPattern = analyzeHistoricalSalesPatterns(transactions, 30);

    // Calculate MRR
    const mrr = calculateMRR(subscriptions, services);

    // Set up date range
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + days);

    // Get subscription renewals
    const dailyRenewals = forecastSubscriptionRevenue(
        subscriptions,
        services,
        clients,
        startDate,
        endDate
    );

    // Generate daily projections
    const projections: DailyProjection[] = [];
    let cumulativeBalance = currentCash;

    for (let i = 0; i < days; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + i);
        const dateKey = currentDate.toISOString().split('T')[0];

        // Subscription revenue for this day
        const renewals = dailyRenewals.get(dateKey) || [];
        const subscriptionRevenue = renewals.reduce((sum, r) => sum + r.amount, 0);

        // Estimate subscription costs (using historical average margin)
        const avgMargin = historicalPattern.averageDailyRevenue > 0
            ? historicalPattern.averageDailyProfit / historicalPattern.averageDailyRevenue
            : 0.3; // Default 30% margin

        const subscriptionCosts = subscriptionRevenue * (1 - avgMargin);

        // One-time sales estimate (if enabled)
        const oneTimeSalesEstimate = includeOneTimeSales
            ? historicalPattern.averageDailyRevenue * optimismFactor
            : 0;

        const oneTimeCostsEstimate = includeOneTimeSales
            ? historicalPattern.averageDailyCosts * optimismFactor
            : 0;

        // Calculate net cash flow for the day
        const totalRevenue = subscriptionRevenue + oneTimeSalesEstimate;
        const totalCosts = subscriptionCosts + oneTimeCostsEstimate;
        const netCashFlow = totalRevenue - totalCosts;

        cumulativeBalance += netCashFlow;

        projections.push({
            date: dateKey,
            subscriptionRevenue,
            oneTimeSalesEstimate,
            subscriptionCosts,
            oneTimeCostsEstimate,
            netCashFlow,
            cumulativeCashBalance: cumulativeBalance,
            renewalCount: renewals.length,
            renewalDetails: renewals
        });
    }

    // Calculate summary statistics
    const totalProjectedRevenue = projections.reduce(
        (sum, p) => sum + p.subscriptionRevenue + p.oneTimeSalesEstimate,
        0
    );

    const totalProjectedCosts = projections.reduce(
        (sum, p) => sum + p.subscriptionCosts + p.oneTimeCostsEstimate,
        0
    );

    // Identify critical dates
    const criticalDates: CashFlowForecast['summary']['criticalDates'] = [];

    projections.forEach(p => {
        // Negative balance
        if (p.cumulativeCashBalance < 0 && criticalDates.filter(cd => cd.type === 'negative').length === 0) {
            criticalDates.push({
                date: p.date,
                type: 'negative',
                balance: p.cumulativeCashBalance,
                description: 'Projected negative balance - requires attention'
            });
        }

        // Low balance warning (below 20% of starting cash)
        if (
            p.cumulativeCashBalance > 0 &&
            p.cumulativeCashBalance < currentCash * 0.2 &&
            criticalDates.filter(cd => cd.type === 'low_balance').length === 0
        ) {
            criticalDates.push({
                date: p.date,
                type: 'low_balance',
                balance: p.cumulativeCashBalance,
                description: 'Low balance warning - consider reducing costs'
            });
        }

        // High revenue days (more than 3 renewals)
        if (p.renewalCount >= 3) {
            criticalDates.push({
                date: p.date,
                type: 'high_revenue',
                balance: p.cumulativeCashBalance,
                description: `${p.renewalCount} subscription renewals expected`
            });
        }
    });

    // Calculate cash runway
    const cashRunway = calculateCashRunway(currentCash, historicalPattern.averageDailyCosts);

    return {
        projections,
        summary: {
            startingBalance: currentCash,
            endingBalance: cumulativeBalance,
            totalProjectedRevenue,
            totalProjectedCosts,
            netCashFlow: totalProjectedRevenue - totalProjectedCosts,
            averageDailyRevenue: totalProjectedRevenue / days,
            averageDailyCosts: totalProjectedCosts / days,
            monthlyRecurringRevenue: mrr,
            cashRunwayDays: cashRunway,
            criticalDates: criticalDates.sort((a, b) => a.date.localeCompare(b.date))
        }
    };
}

/**
 * Get insights and recommendations based on forecast
 */
export function getCashFlowInsights(forecast: CashFlowForecast): string[] {
    const insights: string[] = [];
    const { summary } = forecast;

    // Cash runway insights
    if (summary.cashRunwayDays !== null) {
        if (summary.cashRunwayDays < 30) {
            insights.push(`⚠️ Critical: Only ${summary.cashRunwayDays} days of cash runway remaining`);
        } else if (summary.cashRunwayDays < 60) {
            insights.push(`⚡ Caution: ${summary.cashRunwayDays} days of cash runway - consider increasing sales`);
        } else {
            insights.push(`✅ Healthy: ${summary.cashRunwayDays} days of cash runway`);
        }
    }

    // MRR insights
    if (summary.monthlyRecurringRevenue > 0) {
        insights.push(`💰 Monthly Recurring Revenue: Strong foundation with predictable income`);
    }

    // Cash flow trend
    if (summary.netCashFlow > 0) {
        insights.push(`📈 Positive cash flow trend: Growing by ${Math.round(summary.netCashFlow)} over forecast period`);
    } else {
        insights.push(`📉 Negative cash flow trend: Losing ${Math.round(Math.abs(summary.netCashFlow))} over forecast period`);
    }

    // Balance warnings
    if (summary.endingBalance < summary.startingBalance * 0.5) {
        insights.push(`🔻 Cash balance projected to drop by ${Math.round(((summary.startingBalance - summary.endingBalance) / summary.startingBalance) * 100)}%`);
    }

    // Critical dates
    const negativeBalances = summary.criticalDates.filter(cd => cd.type === 'negative');
    if (negativeBalances.length > 0) {
        insights.push(`❌ Warning: Projected negative balance on ${new Date(negativeBalances[0].date).toLocaleDateString()}`);
    }

    return insights;
}
