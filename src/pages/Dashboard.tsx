import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TrendingUp, DollarSign, Package, ShoppingCart } from 'lucide-react';
import { supabase, Transaction, Service } from '../lib/supabase';
import SearchableDropdown from '../components/SearchableDropdown';
import { toast, copyToClipboard } from '../lib/toast';
import { getNowInTunisia } from '../lib/dateUtils';
import { useCurrency } from '../lib/currency';

export default function Dashboard() {
  const { formatCurrency } = useCurrency();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  type PeriodState = {
    type: 'week' | 'month' | 'year';
    label: string;
    date: Date;
  };

  // Main dashboard view toggle (Daily vs Monthly)
  const [mainDashboardView, setMainDashboardView] = useState<'daily' | 'monthly'>('daily');

  // Separate state for Top Services filtering (independent)
  const [topServicesPeriodState, setTopServicesPeriodState] = useState<PeriodState>({
    type: 'month',
    label: 'This Month',
    date: getNowInTunisia(),
  });

  type AnalyticsPeriodState = {
    type: 'month' | 'quarter' | 'year';
    label: string;
    date: Date;
  };

  const [analyticsPeriodState, setAnalyticsPeriodState] = useState<AnalyticsPeriodState>({
    type: 'month',
    label: 'This Month',
    date: getNowInTunisia(),
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = useCallback(async () => {
    try {
      // Limit initial query to last 30 days for better performance
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

      const [transactionsResult, servicesResult] = await Promise.all([
        supabase
          .from('transactions')
          .select(`
            *,
            services (
              id,
              product_service,
              category,
              duration
            )
          `)
          .gte('date', thirtyDaysAgoStr)
          .order('date', { ascending: false }),
        supabase
          .from('services')
          .select('*')
      ]);

      if (transactionsResult.error) throw transactionsResult.error;
      if (servicesResult.error) throw servicesResult.error;

      setTransactions(transactionsResult.data || []);
      setServices(servicesResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.show('Failed to load data', { type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  const formatAnalyticsPeriod = (type: AnalyticsPeriodState['type'], date: Date, position: 'current' | 'prev' | 'next'): string => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const now = new Date();
    const isCurrentPeriod = (d: Date) => {
      switch (type) {
        case 'month':
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        case 'quarter':
          return d.getFullYear() === now.getFullYear() && 
                 Math.floor(d.getMonth() / 3) === Math.floor(now.getMonth() / 3);
        case 'year':
          return d.getFullYear() === now.getFullYear();
      }
    };

    if (position === 'current' && isCurrentPeriod(date)) {
      return `This ${type.charAt(0).toUpperCase() + type.slice(1)}`;
    }

    switch (type) {
      case 'month':
        return `${months[date.getMonth()]} ${date.getFullYear()}`;
      case 'quarter': {
        const quarterNum = Math.floor(date.getMonth() / 3) + 1;
        return `Q${quarterNum} ${date.getFullYear()}`;
      }
      case 'year':
        return date.getFullYear().toString();
    }
  };

  const formatPeriodRange = (type: PeriodState['type'], date: Date, position: 'current' | 'prev' | 'next'): string => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const now = new Date();
    const isCurrentPeriod = (d: Date) => {
      switch (type) {
        case 'week':
          return d.getFullYear() === now.getFullYear() && 
                 Math.floor(d.getTime() / (7 * 24 * 60 * 60 * 1000)) === 
                 Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
        case 'month':
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        case 'year':
          return d.getFullYear() === now.getFullYear();
      }
    };

    if (position === 'current' && isCurrentPeriod(date)) {
      return `This ${type.charAt(0).toUpperCase() + type.slice(1)}`;
    }

    switch (type) {
      case 'week': {
        const start = new Date(date);
        start.setDate(date.getDate() - date.getDay());
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        return `${start.getDate()} ${months[start.getMonth()].slice(0,3)} - ${end.getDate()} ${months[end.getMonth()].slice(0,3)}`;
      }
      case 'month':
        return `${months[date.getMonth()]} ${date.getFullYear()}`;
      case 'year':
        return date.getFullYear().toString();
    }
  };

  const getDateRange = (period: 'day' | 'week' | 'month' | 'year', date: Date) => {
    // Create new date objects to avoid mutating the original
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    switch (period) {
      case 'day':
        // For day, start and end are the same date
        break;
      case 'week':
        start.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
        end.setDate(start.getDate() + 6); // End of week (Saturday)
        break;
      case 'month':
        start.setDate(1); // Start of month
        end.setMonth(start.getMonth() + 1, 0); // End of month
        break;
      case 'year':
        start.setMonth(0, 1); // Start of year
        end.setMonth(12, 0); // End of year
        break;
    }
    
    // Format as YYYY-MM-DD to match database format
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    return {
      start: formatDate(start),
      end: formatDate(end)
    };
  };

  const getPreviousPeriodRange = (period: 'day' | 'week' | 'month' | 'year', date: Date) => {
    const prevDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    switch (period) {
      case 'day':
        prevDate.setDate(date.getDate() - 1);
        break;
      case 'week':
        prevDate.setDate(date.getDate() - 7);
        break;
      case 'month':
        prevDate.setMonth(date.getMonth() - 1);
        break;
      case 'year':
        prevDate.setFullYear(date.getFullYear() - 1);
        break;
    }
    return getDateRange(period, prevDate);
  };

  // Handler for Top Services period changes (independent)
  const handleTopServicesPeriodChange = useCallback((direction: 'prev' | 'next') => {
    const newDate = new Date(topServicesPeriodState.date);
    switch (topServicesPeriodState.type) {
      case 'week':
        newDate.setDate(topServicesPeriodState.date.getDate() + (direction === 'next' ? 7 : -7));
        break;
      case 'month':
        newDate.setMonth(topServicesPeriodState.date.getMonth() + (direction === 'next' ? 1 : -1));
        break;
      case 'year':
        newDate.setFullYear(topServicesPeriodState.date.getFullYear() + (direction === 'next' ? 1 : -1));
        break;
    }
    
    // Determine if the new date represents current period
    const now = new Date();
    const isCurrentPeriod = (
      topServicesPeriodState.type === 'week' ? 
        Math.floor(newDate.getTime() / (7 * 24 * 60 * 60 * 1000)) === Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000)) :
      topServicesPeriodState.type === 'month' ?
        newDate.getFullYear() === now.getFullYear() && newDate.getMonth() === now.getMonth() :
      newDate.getFullYear() === now.getFullYear()
    );
    
    const position = isCurrentPeriod ? 'current' : (direction === 'next' ? 'next' : 'prev');
    const label = formatPeriodRange(topServicesPeriodState.type, newDate, position);
    
    setTopServicesPeriodState({
      type: topServicesPeriodState.type,
      date: newDate,
      label
    });
  }, [topServicesPeriodState.date, topServicesPeriodState.type]);

  // Main dashboard date ranges (Daily or Monthly based on toggle) - memoized
  const mainDashboardPeriod = useMemo(() => mainDashboardView === 'daily' ? 'day' : 'month', [mainDashboardView]);
  const currentRange = useMemo(() => getDateRange(mainDashboardPeriod, new Date()), [mainDashboardPeriod]);
  const previousRange = useMemo(() => getPreviousPeriodRange(mainDashboardPeriod, new Date()), [mainDashboardPeriod]);

  // Top Services filtering (independent) - memoized
  const topServicesRange = useMemo(() => getDateRange(topServicesPeriodState.type, topServicesPeriodState.date), [topServicesPeriodState.type, topServicesPeriodState.date]);

  // Calculate profits for current and previous periods - memoized
  const calculatePeriodStats = useCallback((transactions: Transaction[], range: { start: string; end: string }) => {
    const periodTransactions = transactions.filter(t => {
      // Ensure we're comparing dates in the same format (YYYY-MM-DD)
      const transactionDate = t.date.split('T')[0]; // Handle both date and datetime formats
      
      // For single day comparison, check exact date match
      if (range.start === range.end) {
        return transactionDate === range.start;
      }
      
      // For date ranges, use standard comparison
      return transactionDate >= range.start && transactionDate <= range.end;
    });

    return {
      profit: periodTransactions.reduce((sum, t) => sum + (t.selling_price - t.cost_at_sale), 0),
      revenue: periodTransactions.reduce((sum, t) => sum + t.selling_price, 0),
      count: periodTransactions.length,
      transactions: periodTransactions
    };
  }, []);

  const currentStats = useMemo(() => calculatePeriodStats(transactions, currentRange), [transactions, currentRange, calculatePeriodStats]);
  const previousStats = useMemo(() => calculatePeriodStats(transactions, previousRange), [transactions, previousRange, calculatePeriodStats]);
  
  const percentageChange = useCallback((current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / Math.abs(previous)) * 100;
  }, []);

  const profitChange = useMemo(() => percentageChange(currentStats.profit, previousStats.profit), [currentStats.profit, previousStats.profit, percentageChange]);

  // Recent transactions - filter for last 24 hours - memoized
  const recentTransactions = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000)).toISOString().split('T')[0];
    
    return transactions.filter(transaction => {
      const transactionDate = transaction.date.split('T')[0]; // Handle both date and datetime formats
      return transactionDate === today || transactionDate === yesterday;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // Sort by most recent first
    .slice(0, 5); // Limit to 5 most recent within 24h
  }, [transactions]);

  // Top services by profit - filtered by Top Services period - memoized
  const topServicesStats = useMemo(() => calculatePeriodStats(transactions, topServicesRange), [transactions, topServicesRange, calculatePeriodStats]);
  
  const topServices = useMemo(() => {
    const serviceProfit = topServicesStats.transactions.reduce((acc, t) => {
      const serviceId = t.service_id;
      if (!acc[serviceId]) {
        acc[serviceId] = {
          service: t.services,
          profit: 0,
          count: 0
        };
      }
      acc[serviceId].profit += (t.selling_price - t.cost_at_sale);
      acc[serviceId].count += 1;
      return acc;
    }, {} as Record<string, { service: any; profit: number; count: number }>);

    return Object.values(serviceProfit)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);
  }, [topServicesStats.transactions]);

  // Analytics Summary - get date range for analytics periods - memoized
  const getAnalyticsDateRange = useCallback((period: 'month' | 'quarter' | 'year', date: Date) => {
    const start = new Date(date);
    const end = new Date(date);
    
    switch (period) {
      case 'month':
        start.setDate(1); // Start of month
        end.setMonth(start.getMonth() + 1, 0); // End of month
        break;
      case 'quarter': {
        const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
        start.setMonth(quarterStartMonth, 1); // Start of quarter
        end.setMonth(quarterStartMonth + 3, 0); // End of quarter
        break;
      }
      case 'year':
        start.setMonth(0, 1); // Start of year
        end.setMonth(12, 0); // End of year
        break;
    }
    
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  }, []);

  const getPreviousAnalyticsPeriodRange = useCallback((period: 'month' | 'quarter' | 'year', date: Date) => {
    const prevDate = new Date(date);
    switch (period) {
      case 'month':
        prevDate.setMonth(date.getMonth() - 1);
        break;
      case 'quarter':
        prevDate.setMonth(date.getMonth() - 3);
        break;
      case 'year':
        prevDate.setFullYear(date.getFullYear() - 1);
        break;
    }
    return getAnalyticsDateRange(period, prevDate);
  }, [getAnalyticsDateRange]);

  // Calculate analytics stats for current and previous periods - memoized
  const currentAnalyticsRange = useMemo(() => getAnalyticsDateRange(analyticsPeriodState.type, analyticsPeriodState.date), [analyticsPeriodState.type, analyticsPeriodState.date, getAnalyticsDateRange]);
  const previousAnalyticsRange = useMemo(() => getPreviousAnalyticsPeriodRange(analyticsPeriodState.type, analyticsPeriodState.date), [analyticsPeriodState.type, analyticsPeriodState.date, getPreviousAnalyticsPeriodRange]);

  const currentAnalyticsStats = useMemo(() => calculatePeriodStats(transactions, currentAnalyticsRange), [transactions, currentAnalyticsRange, calculatePeriodStats]);
  const previousAnalyticsStats = useMemo(() => calculatePeriodStats(transactions, previousAnalyticsRange), [transactions, previousAnalyticsRange, calculatePeriodStats]);

  // Calculate percentage changes for analytics - memoized
  const analyticsOrdersChange = useMemo(() => percentageChange(currentAnalyticsStats.count, previousAnalyticsStats.count), [currentAnalyticsStats.count, previousAnalyticsStats.count, percentageChange]);
  const analyticsRevenueChange = useMemo(() => percentageChange(currentAnalyticsStats.revenue, previousAnalyticsStats.revenue), [currentAnalyticsStats.revenue, previousAnalyticsStats.revenue, percentageChange]);
  const analyticsProfitChange = useMemo(() => percentageChange(currentAnalyticsStats.profit, previousAnalyticsStats.profit), [currentAnalyticsStats.profit, previousAnalyticsStats.profit, percentageChange]);
  
  const currentProfitMargin = useMemo(() => currentAnalyticsStats.revenue > 0 
    ? (currentAnalyticsStats.profit / currentAnalyticsStats.revenue) * 100 
    : 0, [currentAnalyticsStats.revenue, currentAnalyticsStats.profit]);
  const previousProfitMargin = useMemo(() => previousAnalyticsStats.revenue > 0 
    ? (previousAnalyticsStats.profit / previousAnalyticsStats.revenue) * 100 
    : 0, [previousAnalyticsStats.revenue, previousAnalyticsStats.profit]);
  const analyticsMarginChange = useMemo(() => percentageChange(currentProfitMargin, previousProfitMargin), [currentProfitMargin, previousProfitMargin, percentageChange]);

  // Business Health metrics - memoized
  const avgOrderValue = useMemo(() => {
    if (transactions.length === 0) return 0;
    const totalRevenue = transactions.reduce((sum, t) => sum + t.selling_price, 0);
    return totalRevenue / transactions.length;
  }, [transactions]);

  const businessProfitMargin = useMemo(() => {
    if (transactions.length === 0) return '0';
    const totalProfit = transactions.reduce((sum, t) => sum + (t.selling_price - t.cost_at_sale), 0);
    const totalRevenue = transactions.reduce((sum, t) => sum + t.selling_price, 0);
    return totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0';
  }, [transactions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-400">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="mb-6 lg:mb-8">
        <div className="flex flex-col gap-4 sm:gap-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Dashboard Overview</h1>
            <p className="text-gray-400 mt-2 text-sm sm:text-base">Monitor your business performance</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={() => {
                setLoading(true);
                fetchData();
              }}
              className="ghost-button-secondary w-full sm:w-auto px-4 py-2.5 text-sm font-medium rounded-lg hover:bg-gray-600/50 transition-colors"
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="hidden xs:inline">Refresh Data</span>
                <span className="xs:hidden">Refresh</span>
              </span>
            </button>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <span className="text-sm font-medium text-gray-300">View:</span>
              <div className="flex bg-gray-700/50 rounded-lg p-1 w-full sm:w-auto">
                <button
                  onClick={() => setMainDashboardView('daily')}
                  className={`flex-1 sm:flex-none px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    mainDashboardView === 'daily'
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'text-gray-400 hover:text-white hover:bg-gray-600/30'
                  }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setMainDashboardView('monthly')}
                  className={`flex-1 sm:flex-none px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    mainDashboardView === 'monthly'
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'text-gray-400 hover:text-white hover:bg-gray-600/30'
                  }`}
                >
                  Monthly
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards - Dynamic Daily/Monthly Overview */}
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 lg:mb-8">
        {/* Dynamic Overview */}
        <div className="ghost-card p-5 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-gray-300">
              {mainDashboardView === 'daily' ? 'Today\'s Overview' : 'Current Month Overview'}
            </h3>
            <TrendingUp className="h-5 w-5 text-green-500 flex-shrink-0" />
          </div>
          <div className="space-y-5">
            <div>
              <p className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-2">
                {formatCurrency(currentStats.profit)}
              </p>
              <p className="text-sm text-gray-400">
                Period Profit
                <span className={`ml-2 text-sm font-medium ${profitChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {profitChange > 0 ? '↑' : '↓'} {Math.abs(profitChange).toFixed(1)}%
                </span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-700/50">
              <div className="text-center sm:text-left">
                <p className="text-xl sm:text-2xl font-bold text-blue-400">
                  {currentStats.count}
                </p>
                <p className="text-xs text-gray-400 mt-1">Orders</p>
              </div>
              <div className="text-center sm:text-left">
                <p className="text-xl sm:text-2xl font-bold text-green-400">
                  {formatCurrency(currentStats.revenue)}
                </p>
                <p className="text-xs text-gray-400 mt-1">Revenue</p>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Performance Comparison */}
        <div className="ghost-card p-5 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-gray-300">
              {mainDashboardView === 'daily' ? 'Daily Performance' : 'Monthly Performance'}
            </h3>
            <DollarSign className="h-5 w-5 text-green-500 flex-shrink-0" />
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-medium text-gray-400">
                {mainDashboardView === 'daily' ? 'Today' : 'This Month'}
              </span>
              <span className={`text-xl sm:text-2xl font-bold ${currentStats.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(currentStats.profit)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-medium text-gray-400">
                {mainDashboardView === 'daily' ? 'Yesterday' : 'Last Month'}
              </span>
              <span className={`text-xl sm:text-2xl font-bold ${previousStats.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(previousStats.profit)}
              </span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-gray-700/50">
              <span className="text-sm font-medium text-gray-400">
                {mainDashboardView === 'daily' ? 'Daily Change' : 'Monthly Change'}
              </span>
              <span className={`text-xl sm:text-2xl font-bold ${profitChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {profitChange >= 0 ? '↑' : '↓'} {Math.abs(profitChange).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Business Health */}
        <div className="ghost-card p-5 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-gray-300">Business Health</h3>
            <Package className="h-5 w-5 text-green-500 flex-shrink-0" />
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-medium text-gray-400">Active Services</span>
              <span className="text-xl sm:text-2xl font-bold text-blue-400">{services.length}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-medium text-gray-400">Avg. Order Value</span>
              <span className="text-xl sm:text-2xl font-bold text-green-400">
                {formatCurrency(avgOrderValue)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-medium text-gray-400">Profit Margin</span>
              <span className="text-xl sm:text-2xl font-bold text-purple-400">
                {businessProfitMargin}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 mb-6 lg:mb-8">
        {/* Top Services */}
        <div className="ghost-card p-5 lg:p-6 lg:col-span-2">
          <div className="flex flex-col gap-4 mb-5">
            <h2 className="text-lg sm:text-xl lg:text-xl font-bold text-white">Top Performing Services</h2>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-3">
              <div className="flex items-center gap-3 sm:gap-2 w-full sm:w-auto">
                <button
                  onClick={() => handleTopServicesPeriodChange('prev')}
                  className="bg-gray-700 hover:bg-gray-600 active:bg-gray-500 border border-gray-600 hover:border-gray-500 text-white min-h-[56px] min-w-[56px] flex items-center justify-center rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl flex-shrink-0"
                  aria-label="Previous period"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="flex-1 min-w-0">
                  <SearchableDropdown
                    options={[
                      { value: 'week', label: formatPeriodRange('week', new Date(), 'current') },
                      { value: 'month', label: formatPeriodRange('month', new Date(), 'current') },
                      { value: 'year', label: formatPeriodRange('year', new Date(), 'current') }
                    ]}
                    value={topServicesPeriodState.type}
                    onChange={(value) => {
                      const type = value as PeriodState['type'];
                      const now = new Date();
                      setTopServicesPeriodState({
                        type,
                        date: now,
                        label: formatPeriodRange(type, now, 'current')
                      });
                    }}
                    placeholder="Select period"
                    className="w-full min-h-[56px] text-base"
                    showSearchThreshold={10}
                  />
                </div>
                <button
                  onClick={() => handleTopServicesPeriodChange('next')}
                  className="bg-gray-700 hover:bg-gray-600 active:bg-gray-500 border border-gray-600 hover:border-gray-500 text-white min-h-[56px] min-w-[56px] flex items-center justify-center rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl flex-shrink-0"
                  aria-label="Next period"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-3 sm:space-y-4">
            {topServices.length > 0 ? (
              topServices.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-4 sm:p-5 bg-gray-700/50 rounded-lg hover:bg-gray-700/70 transition-colors min-h-[72px]">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center text-base font-bold">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-white text-base sm:text-lg truncate">{item.service?.product_service}</h3>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm mt-2">
                        <span className="text-gray-400 font-medium">{item.count} orders</span>
                        <span className="hidden sm:inline text-gray-600">•</span>
                        <span className="text-gray-400 font-medium">
                          {formatCurrency((item.profit / item.count) || 0)} avg. profit
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className={`font-bold text-lg sm:text-xl ${item.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(item.profit)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">total profit</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No transactions yet</p>
                <p className="text-gray-500 text-sm mt-2">Start selling services to see analytics</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="ghost-card p-5 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg sm:text-xl font-bold text-white">Recent Activity</h2>
            <span className="text-xs text-gray-400 bg-gray-700/50 px-2 py-1 rounded-full">Last 24h</span>
          </div>
          <div className="space-y-3 sm:space-y-4">
            {recentTransactions.length > 0 ? (
              recentTransactions.map((transaction) => {
                const profit = transaction.selling_price - transaction.cost_at_sale;
                const time = new Date(transaction.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={transaction.id} className="flex items-center gap-4 p-4 bg-gray-700/30 rounded-lg hover:bg-gray-700/50 transition-colors min-h-[64px]">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${profit >= 0 ? 'bg-green-400' : 'bg-red-400'}`} />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white text-base sm:text-lg truncate">{transaction.services?.product_service}</h3>
                      <p className="text-sm text-gray-400 mt-1 font-medium">{time}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`font-bold text-lg sm:text-xl ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(profit)}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12">
                <ShoppingCart className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No recent activity</p>
                <p className="text-gray-500 text-sm mt-2">Transactions will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Analytics Summary */}
      <div className="ghost-card p-5 lg:p-6">
        <div className="flex flex-col gap-4 mb-5 lg:mb-6">
          <h2 className="text-lg lg:text-xl font-bold text-white">Analytics Summary</h2>
          
          {/* Mobile-optimized date controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-3">
            {/* Navigation buttons - mobile: full width, desktop: fixed width */}
            <div className="flex items-center gap-3 sm:gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  const newDate = new Date(analyticsPeriodState.date);
                  switch (analyticsPeriodState.type) {
                    case 'month':
                      newDate.setMonth(newDate.getMonth() - 1);
                      break;
                    case 'quarter':
                      newDate.setMonth(newDate.getMonth() - 3);
                      break;
                    case 'year':
                      newDate.setFullYear(newDate.getFullYear() - 1);
                      break;
                  }
                  
                  const now = new Date();
                  const isCurrentPeriod = (
                    analyticsPeriodState.type === 'month' ?
                      newDate.getFullYear() === now.getFullYear() && newDate.getMonth() === now.getMonth() :
                    analyticsPeriodState.type === 'quarter' ?
                      newDate.getFullYear() === now.getFullYear() && Math.floor(newDate.getMonth() / 3) === Math.floor(now.getMonth() / 3) :
                    newDate.getFullYear() === now.getFullYear()
                  );

                  const position = isCurrentPeriod ? 'current' : 'prev';
                  const label = formatAnalyticsPeriod(analyticsPeriodState.type, newDate, position);
                  
                  setAnalyticsPeriodState({
                    type: analyticsPeriodState.type,
                    date: newDate,
                    label
                  });
                }}
                className="bg-gray-700 hover:bg-gray-600 active:bg-gray-500 border border-gray-600 hover:border-gray-500 text-white min-h-[56px] min-w-[56px] flex items-center justify-center rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl flex-shrink-0"
                aria-label="Previous period"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <div className="flex-1 min-w-0">
                <SearchableDropdown
                  options={[
                    { value: 'month', label: formatAnalyticsPeriod('month', new Date(), 'current') },
                    { value: 'quarter', label: formatAnalyticsPeriod('quarter', new Date(), 'current') },
                    { value: 'year', label: formatAnalyticsPeriod('year', new Date(), 'current') }
                  ]}
                  value={analyticsPeriodState.type}
                  onChange={(value) => {
                    const type = value as AnalyticsPeriodState['type'];
                    const now = new Date();
                    setAnalyticsPeriodState({
                      type,
                      date: now,
                      label: formatAnalyticsPeriod(type, now, 'current')
                    });
                  }}
                  placeholder="Select period"
                  className="w-full min-h-[56px] text-base"
                  showSearchThreshold={10}
                />
              </div>
              
              <button
                onClick={() => {
                  const newDate = new Date(analyticsPeriodState.date);
                  switch (analyticsPeriodState.type) {
                    case 'month':
                      newDate.setMonth(newDate.getMonth() + 1);
                      break;
                    case 'quarter':
                      newDate.setMonth(newDate.getMonth() + 3);
                      break;
                    case 'year':
                      newDate.setFullYear(newDate.getFullYear() + 1);
                      break;
                  }

                  const now = new Date();
                  const isCurrentPeriod = (
                    analyticsPeriodState.type === 'month' ?
                      newDate.getFullYear() === now.getFullYear() && newDate.getMonth() === now.getMonth() :
                    analyticsPeriodState.type === 'quarter' ?
                      newDate.getFullYear() === now.getFullYear() && Math.floor(newDate.getMonth() / 3) === Math.floor(now.getMonth() / 3) :
                    newDate.getFullYear() === now.getFullYear()
                  );

                  const position = isCurrentPeriod ? 'current' : 'next';
                  const label = formatAnalyticsPeriod(analyticsPeriodState.type, newDate, position);
                  
                  setAnalyticsPeriodState({
                    type: analyticsPeriodState.type,
                    date: newDate,
                    label
                  });
                }}
                className="bg-gray-700 hover:bg-gray-600 active:bg-gray-500 border border-gray-600 hover:border-gray-500 text-white min-h-[56px] min-w-[56px] flex items-center justify-center rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl flex-shrink-0"
                aria-label="Next period"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-4 lg:gap-6">
          <div className="p-5 bg-gray-700/50 rounded-lg hover:bg-gray-700/70 transition-colors">
            <div className="flex flex-col">
              <p className="text-sm font-medium text-gray-400 mb-2">Total Orders</p>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">{currentAnalyticsStats.count}</p>
              <p className="text-sm text-gray-400">
                <span className={`font-semibold ${analyticsOrdersChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {analyticsOrdersChange >= 0 ? '↑' : '↓'} {Math.abs(analyticsOrdersChange).toFixed(1)}%
                </span> vs last period
              </p>
            </div>
          </div>
          <div className="p-5 bg-gray-700/50 rounded-lg hover:bg-gray-700/70 transition-colors">
            <div className="flex flex-col">
              <p className="text-sm font-medium text-gray-400 mb-2">Total Revenue</p>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">
                {formatCurrency(currentAnalyticsStats.revenue)}
              </p>
              <p className="text-sm text-gray-400">
                <span className={`font-semibold ${analyticsRevenueChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {analyticsRevenueChange >= 0 ? '↑' : '↓'} {Math.abs(analyticsRevenueChange).toFixed(1)}%
                </span> vs last period
              </p>
            </div>
          </div>
          <div className="p-5 bg-gray-700/50 rounded-lg hover:bg-gray-700/70 transition-colors">
            <div className="flex flex-col">
              <p className="text-sm font-medium text-gray-400 mb-2">Net Profit</p>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">
                {formatCurrency(currentAnalyticsStats.profit)}
              </p>
              <p className="text-sm text-gray-400">
                <span className={`font-semibold ${analyticsProfitChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {analyticsProfitChange >= 0 ? '↑' : '↓'} {Math.abs(analyticsProfitChange).toFixed(1)}%
                </span> vs last period
              </p>
            </div>
          </div>
          <div className="p-5 bg-gray-700/50 rounded-lg hover:bg-gray-700/70 transition-colors">
            <div className="flex flex-col">
              <p className="text-sm font-medium text-gray-400 mb-2">Profit Margin</p>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">
                {currentProfitMargin.toFixed(1)}%
              </p>
              <p className="text-sm text-gray-400">
                <span className={`font-semibold ${analyticsMarginChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {analyticsMarginChange >= 0 ? '↑' : '↓'} {Math.abs(analyticsMarginChange).toFixed(1)}%
                </span> vs last period
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}