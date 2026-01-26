import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cashFlowService } from '../lib/cashFlowService';
import {
    MoneyPoolWithStatus,
    TodaysNumbers as TodaysNumbersType,
    WeeklyPulse as WeeklyPulseType,
    DecisionZone as DecisionZoneType,
    UpcomingMoneyItem,
    MoneyPoolName
} from '../types/cashflow';

// Components
import MoneyPools from '../components/MoneyPools';
import TodaysNumbers from '../components/TodaysNumbers';
import WeeklyPulse from '../components/WeeklyPulse';
import DecisionZone from '../components/DecisionZone';
import UpcomingMoney from '../components/UpcomingMoney';
import TransferMoneyModal from '../components/TransferMoneyModal';
import AddAdSpendModal from '../components/AddAdSpendModal';
import AddPayoutModal from '../components/AddPayoutModal';

// Default data for when database tables don't exist yet
const defaultPools: MoneyPoolWithStatus[] = [
    { id: '1', name: 'business_vault', display_name: 'Business Vault', balance: 0, target: 3000, status: 'red', deficit: 3000, created_at: '', updated_at: '' },
    { id: '2', name: 'savings', display_name: 'Savings', balance: 0, target: 1000, status: 'red', deficit: 1000, created_at: '', updated_at: '' },
    { id: '3', name: 'personal', display_name: 'Personal', balance: 0, target: 500, status: 'red', deficit: 500, created_at: '', updated_at: '' }
];

const defaultTodaysNumbers: TodaysNumbersType = {
    revenue: 0,
    salesCount: 0,
    adSpend: 0,
    cogs: 0,
    netProfit: 0,
    pendingPayouts: 0,
    pendingPayoutDays: null
};

const defaultWeeklyPulse: WeeklyPulseType = {
    days: [],
    weekTotal: 0,
    weekTarget: 350,
    percentAchieved: 0,
    vsLastWeek: 0
};

const defaultDecisionZone: DecisionZoneType = {
    status: 'yellow',
    headline: '⚠️ SETUP REQUIRED',
    description: 'Run the database migration to enable money pools tracking.',
    suggestedActions: [
        'Run the Supabase migration: 20260124000000_cashflow_redesign.sql',
        'Set initial balances for each money pool',
        'Add today\'s ad spend if applicable'
    ]
};

export default function CashFlow() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    // Data state
    const [pools, setPools] = useState<MoneyPoolWithStatus[]>(defaultPools);
    const [todaysNumbers, setTodaysNumbers] = useState<TodaysNumbersType>(defaultTodaysNumbers);
    const [weeklyPulse, setWeeklyPulse] = useState<WeeklyPulseType>(defaultWeeklyPulse);
    const [decisionZone, setDecisionZone] = useState<DecisionZoneType>(defaultDecisionZone);
    const [upcomingMoney, setUpcomingMoney] = useState<UpcomingMoneyItem[]>([]);

    // Modal state
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showAdSpendModal, setShowAdSpendModal] = useState(false);
    const [showPayoutModal, setShowPayoutModal] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch all data in parallel
            const [poolsData, todaysData, weeklyData, upcomingData] = await Promise.all([
                cashFlowService.getMoneyPools().catch(() => null),
                cashFlowService.getTodaysNumbers().catch(() => null),
                cashFlowService.getWeeklyPulse().catch(() => null),
                cashFlowService.getUpcomingMoney().catch(() => [])
            ]);

            // Use fetched data or defaults
            const finalPools = poolsData || defaultPools;
            const finalTodays = todaysData || defaultTodaysNumbers;
            const finalWeekly = weeklyData || defaultWeeklyPulse;

            setPools(finalPools);
            setTodaysNumbers(finalTodays);
            setWeeklyPulse(finalWeekly);
            setUpcomingMoney(upcomingData);

            // Calculate decision zone based on actual data
            if (poolsData && todaysData && weeklyData) {
                const decision = await cashFlowService.getDecisionZone(finalTodays, finalPools, finalWeekly);
                setDecisionZone(decision);
            } else {
                // Show setup message if tables don't exist
                setDecisionZone(defaultDecisionZone);
            }
        } catch (err: any) {
            console.error('Error fetching cashflow data:', err);
            setError('Unable to load some data. Database tables may need to be created.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData, refreshKey]);

    const handleRefresh = () => {
        setRefreshKey(k => k + 1);
    };

    const handleTransfer = async (
        fromPool: MoneyPoolName | 'external',
        toPool: MoneyPoolName | 'external',
        amount: number,
        notes?: string
    ) => {
        await cashFlowService.transferBetweenPools(fromPool, toPool, amount, notes);
        handleRefresh();
    };

    const handleAddAdSpend = async (date: string, amount: number, platform: string, notes?: string) => {
        await cashFlowService.addAdSpend(date, amount, platform, notes);
        handleRefresh();
    };

    const handleAddPayout = async (source: string, amount: number, expectedDate: string, notes?: string) => {
        await cashFlowService.addPendingPayout(source, amount, expectedDate, notes);
        handleRefresh();
    };

    const handleEditTarget = (poolName: MoneyPoolName) => {
        const newTarget = prompt(`Enter new target for ${poolName}:`);
        if (newTarget) {
            const target = parseFloat(newTarget);
            if (!isNaN(target) && target >= 0) {
                cashFlowService.updatePoolTarget(poolName, target).then(handleRefresh);
            }
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex items-center gap-3 text-gray-400">
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    <span>Loading cashflow data...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
                        <TrendingUp className="h-7 w-7 text-green-400" />
                        Cash Flow
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                        Your money at a glance. Make decisions, not reports.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={handleRefresh}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setShowAdSpendModal(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Ad Spend
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setShowPayoutModal(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Payout
                    </Button>
                </div>
            </div>

            {/* Error banner */}
            {error && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-yellow-400 text-sm">
                    <p>{error}</p>
                    <p className="text-xs mt-1 text-yellow-500">
                        Showing default values. Run the database migration to enable full functionality.
                    </p>
                </div>
            )}

            {/* Section 1: Money Pools */}
            <MoneyPools
                pools={pools}
                onTransfer={() => setShowTransferModal(true)}
                onEditTarget={handleEditTarget}
            />

            {/* Section 2: Today's Numbers */}
            <TodaysNumbers data={todaysNumbers} />

            {/* Section 3 & 4: Weekly Pulse and Decision Zone side by side on large screens */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <WeeklyPulse data={weeklyPulse} />
                <DecisionZone data={decisionZone} />
            </div>

            {/* Section 5: Upcoming Money */}
            <UpcomingMoney items={upcomingMoney} />

            {/* Modals */}
            {showTransferModal && (
                <TransferMoneyModal
                    pools={pools}
                    onClose={() => setShowTransferModal(false)}
                    onTransfer={handleTransfer}
                />
            )}

            {showAdSpendModal && (
                <AddAdSpendModal
                    onClose={() => setShowAdSpendModal(false)}
                    onAdd={handleAddAdSpend}
                />
            )}

            {showPayoutModal && (
                <AddPayoutModal
                    onClose={() => setShowPayoutModal(false)}
                    onAdd={handleAddPayout}
                />
            )}
        </div>
    );
}
