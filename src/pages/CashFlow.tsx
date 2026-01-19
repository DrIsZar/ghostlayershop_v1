import { useState, useEffect, useMemo } from 'react';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Calendar,
    AlertTriangle,
    CheckCircle,
    Activity,
    Download
} from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { supabase, Transaction, Service } from '../lib/supabase';
import { subscriptionService } from '../lib/subscriptionService';
import { Subscription } from '../types/subscription';
import {
    generateCashFlowForecast,
    getCashFlowInsights,
    type CashFlowForecast,
    type ForecastOptions
} from '../lib/cashFlowForecast';
import { useCurrency } from '../lib/currency';
import SearchableDropdown from '../components/SearchableDropdown';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

interface Client {
    id: string;
    name: string;
}

export default function CashFlow() {
    const { formatCurrency } = useCurrency();
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [clients, setClients] = useState<Client[]>([]);

    // Forecast options
    const [forecastDays, setForecastDays] = useState<30 | 60 | 90 | 180>(90);
    const [optimismLevel, setOptimismLevel] = useState<'pessimistic' | 'realistic' | 'optimistic'>('realistic');
    const [includeOneTimeSales, setIncludeOneTimeSales] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);

            const [transactionsResult, servicesResult, subscriptionsData, clientsResult] = await Promise.all([
                supabase.from('transactions').select('*').order('date', { ascending: false }),
                supabase.from('services').select('*'),
                subscriptionService.listSubscriptions(),
                supabase.from('clients').select('id, name')
            ]);

            if (transactionsResult.error) throw transactionsResult.error;
            if (servicesResult.error) throw servicesResult.error;
            if (clientsResult.error) throw clientsResult.error;

            setTransactions(transactionsResult.data || []);
            setServices(servicesResult.data || []);
            setSubscriptions(subscriptionsData || []);
            setClients(clientsResult.data || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Generate forecast
    const forecast: CashFlowForecast = useMemo(() => {
        const optimismFactors = {
            pessimistic: 0.7,
            realistic: 1.0,
            optimistic: 1.3
        };

        const options: ForecastOptions = {
            days: forecastDays,
            includeOneTimeSales,
            optimismFactor: optimismFactors[optimismLevel]
        };

        return generateCashFlowForecast(transactions, subscriptions, services, clients, options);
    }, [transactions, subscriptions, services, clients, forecastDays, optimismLevel, includeOneTimeSales]);

    const insights = useMemo(() => getCashFlowInsights(forecast), [forecast]);

    // Prepare chart data
    const chartData = useMemo(() => {
        const labels = forecast.projections.map(p => {
            const date = new Date(p.date);
            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        });

        const balanceData = forecast.projections.map(p => p.cumulativeCashBalance);
        const revenueData = forecast.projections.map(p => p.subscriptionRevenue + p.oneTimeSalesEstimate);
        const costsData = forecast.projections.map(p => p.subscriptionCosts + p.oneTimeCostsEstimate);

        return {
            balance: {
                labels,
                datasets: [
                    {
                        label: 'Projected Cash Balance',
                        data: balanceData,
                        borderColor: 'rgb(74, 222, 128)',
                        backgroundColor: 'rgba(74, 222, 128, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 4
                    }
                ]
            },
            cashFlow: {
                labels,
                datasets: [
                    {
                        label: 'Revenue',
                        data: revenueData,
                        borderColor: 'rgb(74, 222, 128)',
                        backgroundColor: 'rgba(74, 222, 128, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 4
                    },
                    {
                        label: 'Costs',
                        data: costsData,
                        borderColor: 'rgb(248, 113, 113)',
                        backgroundColor: 'rgba(248, 113, 113, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 4
                    }
                ]
            }
        };
    }, [forecast]);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                labels: {
                    color: 'rgb(156, 163, 175)',
                    font: { size: 12 },
                    usePointStyle: true,
                    pointStyle: 'circle'
                }
            },
            tooltip: {
                mode: 'index' as const,
                intersect: false,
                backgroundColor: 'rgba(31, 41, 55, 0.9)',
                titleColor: 'rgb(255, 255, 255)',
                bodyColor: 'rgb(209, 213, 219)',
                borderColor: 'rgb(75, 85, 99)',
                borderWidth: 1,
                padding: 12,
                displayColors: true,
                callbacks: {
                    label: function (context: any) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        label += formatCurrency(context.parsed.y);
                        return label;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: {
                    color: 'rgba(75, 85, 99, 0.3)',
                    drawBorder: false
                },
                ticks: {
                    color: 'rgb(156, 163, 175)',
                    maxRotation: 45,
                    minRotation: 45
                }
            },
            y: {
                grid: {
                    color: 'rgba(75, 85, 99, 0.3)',
                    drawBorder: false
                },
                ticks: {
                    color: 'rgb(156, 163, 175)',
                    callback: function (value: any) {
                        return formatCurrency(value);
                    }
                }
            }
        },
        interaction: {
            mode: 'nearest' as const,
            axis: 'x' as const,
            intersect: false
        }
    };

    // Export forecast data
    const exportForecast = () => {
        const csvContent = [
            ['Date', 'Subscription Revenue', 'One-Time Sales', 'Subscription Costs', 'One-Time Costs', 'Net Cash Flow', 'Cumulative Balance', 'Renewals'].join(','),
            ...forecast.projections.map(p => [
                p.date,
                p.subscriptionRevenue,
                p.oneTimeSalesEstimate,
                p.subscriptionCosts,
                p.oneTimeCostsEstimate,
                p.netCashFlow,
                p.cumulativeCashBalance,
                p.renewalCount
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cash-flow-forecast-${forecastDays}days-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-lg text-gray-400">Loading cash flow data...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white">Cash Flow Forecast</h1>
                    <p className="text-gray-400 mt-1 text-sm sm:text-base">
                        Predict your financial future based on subscriptions and sales patterns
                    </p>
                </div>
                <button
                    onClick={exportForecast}
                    className="ghost-button-secondary flex items-center gap-2 px-4 py-2.5 text-sm font-medium"
                >
                    <Download className="h-4 w-4" />
                    Export Forecast
                </button>
            </div>

            {/* Control Panel */}
            <div className="ghost-card p-4 sm:p-6">
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[140px]">
                        <SearchableDropdown
                            label="Forecast Period"
                            options={[
                                { value: '30', label: '30 Days' },
                                { value: '60', label: '60 Days' },
                                { value: '90', label: '90 Days' },
                                { value: '180', label: '180 Days' }
                            ]}
                            value={String(forecastDays)}
                            onChange={(value) => setForecastDays(Number(value) as 30 | 60 | 90 | 180)}
                            placeholder="Select period"
                            className="w-full"
                            showSearchThreshold={10}
                        />
                    </div>

                    <div className="flex-1 min-w-[160px]">
                        <SearchableDropdown
                            label="Scenario"
                            options={[
                                { value: 'pessimistic', label: 'Pessimistic (70%)' },
                                { value: 'realistic', label: 'Realistic (100%)' },
                                { value: 'optimistic', label: 'Optimistic (130%)' }
                            ]}
                            value={optimismLevel}
                            onChange={(value) => setOptimismLevel(value as typeof optimismLevel)}
                            placeholder="Select scenario"
                            className="w-full"
                            showSearchThreshold={10}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={includeOneTimeSales}
                                onChange={(e) => setIncludeOneTimeSales(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-green-500 focus:ring-green-500 focus:ring-offset-gray-900"
                            />
                            <span>Include one-time sales estimate</span>
                        </label>
                    </div>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="ghost-card p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-300">Current Balance</h3>
                        <DollarSign className="h-5 w-5 text-white" />
                    </div>
                    <p className={`text-3xl font-bold ${forecast.summary.startingBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(forecast.summary.startingBalance)}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">From transaction history</p>
                </div>

                <div className="ghost-card p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-300">Projected Balance</h3>
                        {forecast.summary.endingBalance > forecast.summary.startingBalance ? (
                            <TrendingUp className="h-5 w-5 text-green-400" />
                        ) : (
                            <TrendingDown className="h-5 w-5 text-red-400" />
                        )}
                    </div>
                    <p className={`text-3xl font-bold ${forecast.summary.endingBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(forecast.summary.endingBalance)}
                    </p>
                    <p className={`text-xs mt-2 ${forecast.summary.netCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {forecast.summary.netCashFlow >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(forecast.summary.netCashFlow))} in {forecastDays} days
                    </p>
                </div>

                <div className="ghost-card p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-300">Cash Runway</h3>
                        <Calendar className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-3xl font-bold text-white">
                        {forecast.summary.cashRunwayDays !== null ? `${forecast.summary.cashRunwayDays}` : '∞'}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                        {forecast.summary.cashRunwayDays !== null ? 'days remaining' : 'Positive cash flow'}
                    </p>
                </div>

                <div className="ghost-card p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-300">Monthly Recurring</h3>
                        <Activity className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-3xl font-bold text-green-400">
                        {formatCurrency(forecast.summary.monthlyRecurringRevenue)}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">MRR from subscriptions</p>
                </div>
            </div>

            {/* Insights & Alerts */}
            {(insights.length > 0 || forecast.summary.criticalDates.length > 0) && (
                <div className="ghost-card p-5">
                    <h2 className="text-lg font-bold text-white mb-4">Insights & Alerts</h2>
                    <div className="space-y-3">
                        {insights.map((insight, index) => {
                            const isWarning = insight.includes('⚠️') || insight.includes('❌') || insight.includes('🔻');
                            const isPositive = insight.includes('✅') || insight.includes('💰') || insight.includes('📈');

                            return (
                                <div
                                    key={index}
                                    className={`flex items-start gap-3 p-3 rounded-lg ${isWarning ? 'bg-red-500/10 border border-red-500/20' :
                                            isPositive ? 'bg-green-500/10 border border-green-500/20' :
                                                'bg-gray-700/30 border border-gray-600/30'
                                        }`}
                                >
                                    {isWarning ? (
                                        <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                                    ) : isPositive ? (
                                        <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                                    ) : (
                                        <Activity className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                                    )}
                                    <p className="text-sm text-gray-300">{insight}</p>
                                </div>
                            );
                        })}

                        {forecast.summary.criticalDates.slice(0, 5).map((critical, index) => (
                            <div
                                key={`critical-${index}`}
                                className={`flex items-start gap-3 p-3 rounded-lg ${critical.type === 'negative' || critical.type === 'low_balance'
                                        ? 'bg-red-500/10 border border-red-500/20'
                                        : 'bg-blue-500/10 border border-blue-500/20'
                                    }`}
                            >
                                <Calendar className={`h-5 w-5 flex-shrink-0 mt-0.5 ${critical.type === 'negative' || critical.type === 'low_balance' ? 'text-red-400' : 'text-blue-400'
                                    }`} />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-white">
                                        {new Date(critical.date).toLocaleDateString(undefined, {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric'
                                        })}
                                    </p>
                                    <p className="text-sm text-gray-300 mt-1">{critical.description}</p>
                                    <p className={`text-xs mt-1 ${critical.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        Balance: {formatCurrency(critical.balance)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Cash Balance Chart */}
            <div className="ghost-card p-5">
                <h2 className="text-lg font-bold text-white mb-4">Projected Cash Balance</h2>
                <div className="h-80">
                    <Line data={chartData.balance} options={chartOptions} />
                </div>
            </div>

            {/* Revenue vs Costs Chart */}
            <div className="ghost-card p-5">
                <h2 className="text-lg font-bold text-white mb-4">Revenue vs Costs</h2>
                <div className="h-80">
                    <Line data={chartData.cashFlow} options={chartOptions} />
                </div>
            </div>

            {/* Revenue Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="ghost-card p-5">
                    <h2 className="text-lg font-bold text-white mb-4">Revenue Breakdown</h2>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-gray-700/30 rounded-lg">
                            <span className="text-sm text-gray-300">Subscription Revenue</span>
                            <span className="text-lg font-bold text-green-400">
                                {formatCurrency(
                                    forecast.projections.reduce((sum, p) => sum + p.subscriptionRevenue, 0)
                                )}
                            </span>
                        </div>
                        {includeOneTimeSales && (
                            <div className="flex justify-between items-center p-3 bg-gray-700/30 rounded-lg">
                                <span className="text-sm text-gray-300">One-Time Sales (Estimated)</span>
                                <span className="text-lg font-bold text-white">
                                    {formatCurrency(
                                        forecast.projections.reduce((sum, p) => sum + p.oneTimeSalesEstimate, 0)
                                    )}
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between items-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                            <span className="text-sm font-medium text-gray-200">Total Revenue</span>
                            <span className="text-xl font-bold text-green-400">
                                {formatCurrency(forecast.summary.totalProjectedRevenue)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="ghost-card p-5">
                    <h2 className="text-lg font-bold text-white mb-4">Cost Breakdown</h2>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-gray-700/30 rounded-lg">
                            <span className="text-sm text-gray-300">Subscription Costs</span>
                            <span className="text-lg font-bold text-white">
                                {formatCurrency(
                                    forecast.projections.reduce((sum, p) => sum + p.subscriptionCosts, 0)
                                )}
                            </span>
                        </div>
                        {includeOneTimeSales && (
                            <div className="flex justify-between items-center p-3 bg-gray-700/30 rounded-lg">
                                <span className="text-sm text-gray-300">One-Time Costs (Estimated)</span>
                                <span className="text-lg font-bold text-white">
                                    {formatCurrency(
                                        forecast.projections.reduce((sum, p) => sum + p.oneTimeCostsEstimate, 0)
                                    )}
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between items-center p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <span className="text-sm font-medium text-gray-200">Total Costs</span>
                            <span className="text-xl font-bold text-red-400">
                                {formatCurrency(forecast.summary.totalProjectedCosts)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
