import { useState, useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, DollarSign, Users, Package, Download, Target, AlertTriangle, TrendingDown, Archive, Clock } from 'lucide-react';
import { supabase, Transaction, Service } from '../lib/supabase';
import type { Client } from '../types/client';
import { clientsDb } from '../lib/clients';
import SearchableDropdown from '../components/SearchableDropdown';
import { listResourcePools } from '../lib/inventory';
import { ResourcePool } from '../types/inventory';
import { useCurrency } from '../lib/currency';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ReportData {
  totalRevenue: number;
  totalProfit: number;
  totalTransactions: number;
  totalClients: number;
  totalServices: number;
  averageProfitMargin: number;
  averageTransactionValue: number;
  topServices: Array<{ name: string; revenue: number; profit: number; count: number }>;
  monthlyData: Array<{ month: string; revenue: number; profit: number; transactions: number }>;
  serviceCategoryData: Array<{ category: string; count: number; revenue: number; profit: number }>;
  clientTypeData: Array<{ type: string; count: number; totalSpent: number }>;
  topClients: Array<{ name: string; totalSpent: number; transactions: number; type: string }>;
  serviceDurationData: Array<{ duration: string; count: number; revenue: number }>;
  profitTrends: { trend: 'up' | 'down' | 'stable'; percentage: number; period: string };
  lowProfitServices: Array<{ name: string; revenue: number; profit: number; margin: number }>;
  // Inventory data
  inventoryData: {
    totalPools: number;
    activePools: number;
    expiringSoon: number;
    totalSeats: number;
    usedSeats: number;
    utilizationRate: number;
    poolsByProvider: Array<{ provider: string; count: number; seats: number }>;
    expiringPools: Array<{ provider: string; login_email: string; end_at: string; daysLeft: number }>;
  };
}

export default function Reports() {
  const { formatCurrency } = useCurrency();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [, setTransactions] = useState<Transaction[]>([]);
  const [, setServices] = useState<Service[]>([]);
  const [, setClients] = useState<Client[]>([]);
  const [showLowProfitAlert, setShowLowProfitAlert] = useState(false);

  // Helper functions defined first
  const getMonthlyData = useCallback((transactions: Transaction[]) => {
    const months = [];
    const now = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.unshift(date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
    }

    const monthlyData = months.map(month => {
      const monthTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        const monthYear = transactionDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        return monthYear === month;
      });

      const revenue = monthTransactions.reduce((sum, t) => sum + (t.selling_price || 0), 0);
      const profit = monthTransactions.reduce((sum, t) => sum + ((t.selling_price || 0) - (t.cost_at_sale || 0)), 0);

      return {
        month,
        revenue,
        profit,
        transactions: monthTransactions.length
      };
    });

    return monthlyData;
  }, []);

  const analyzeProfitTrends = useCallback((monthlyData: Array<{ month: string; revenue: number; profit: number; transactions: number }>) => {
    if (monthlyData.length < 2) return { trend: 'stable' as const, percentage: 0, period: 'N/A' };
    
    const recent = monthlyData.slice(-3);
    const previous = monthlyData.slice(-6, -3);
    
    const recentAvg = recent.reduce((sum, m) => sum + m.profit, 0) / recent.length;
    const previousAvg = previous.reduce((sum, m) => sum + m.profit, 0) / previous.length;
    
    if (previousAvg === 0) return { trend: 'stable' as const, percentage: 0, period: 'N/A' };
    
    const percentage = ((recentAvg - previousAvg) / previousAvg) * 100;
    
    let trend: 'up' | 'down' | 'stable';
    if (percentage > 5) trend = 'up';
    else if (percentage < -5) trend = 'down';
    else trend = 'stable';
    
    return {
      trend,
      percentage: Math.abs(percentage),
      period: '3 months'
    };
  }, []);

  const processReportData = useCallback((
    transactions: Transaction[],
    services: Service[],
    clients: Client[],
    pools: ResourcePool[]
  ): ReportData => {
    // Calculate totals
    const totalRevenue = transactions.reduce((sum, t) => sum + (t.selling_price || 0), 0);
    const totalCost = transactions.reduce((sum, t) => sum + (t.cost_at_sale || 0), 0);
    const totalProfit = totalRevenue - totalCost;
    const totalTransactions = transactions.length;
    const totalClients = clients.length;
    const totalServices = services.length;
    const averageProfitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const averageTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    // Top services by revenue
    const serviceRevenue = new Map<string, { revenue: number; profit: number; count: number }>();
    transactions.forEach(t => {
      const serviceName = t.services?.product_service || 'Unknown';
      const existing = serviceRevenue.get(serviceName) || { revenue: 0, profit: 0, count: 0 };
      serviceRevenue.set(serviceName, {
        revenue: existing.revenue + (t.selling_price || 0),
        profit: existing.profit + ((t.selling_price || 0) - (t.cost_at_sale || 0)),
        count: existing.count + 1
      });
    });

    const topServices = Array.from(serviceRevenue.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Monthly data
    const monthlyData = getMonthlyData(transactions);

    // Service category data with profit
    const categoryData = new Map<string, { count: number; revenue: number; profit: number }>();
    transactions.forEach(t => {
      const category = t.services?.category || 'Unknown';
      const existing = categoryData.get(category) || { count: 0, revenue: 0, profit: 0 };
      categoryData.set(category, {
        count: existing.count + 1,
        revenue: existing.revenue + (t.selling_price || 0),
        profit: existing.profit + ((t.selling_price || 0) - (t.cost_at_sale || 0))
      });
    });

    const serviceCategoryData = Array.from(categoryData.entries())
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.revenue - a.revenue);

    // Client type data
    const clientTypeData = new Map<string, { count: number; totalSpent: number }>();
    clients.forEach(client => {
      const existing = clientTypeData.get(client.type) || { count: 0, totalSpent: 0 };
      const clientTransactions = transactions.filter(t => t.client_id === client.id);
      const totalSpent = clientTransactions.reduce((sum, t) => sum + (t.selling_price || 0), 0);
      
      clientTypeData.set(client.type, {
        count: existing.count + 1,
        totalSpent: existing.totalSpent + totalSpent
      });
    });

    const clientTypeDataArray = Array.from(clientTypeData.entries())
      .map(([type, data]) => ({ type, ...data }));

    // Top clients
    const clientData = new Map<string, { name: string; totalSpent: number; transactions: number; type: string }>();
    clients.forEach(client => {
      const clientTransactions = transactions.filter(t => t.client_id === client.id);
      const totalSpent = clientTransactions.reduce((sum, t) => sum + (t.selling_price || 0), 0);
      
      if (totalSpent > 0) {
        clientData.set(client.id, {
          name: client.name,
          totalSpent,
          transactions: clientTransactions.length,
          type: client.type
        });
      }
    });

    const topClients = Array.from(clientData.values())
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5);

    // Service duration analysis
    const durationData = new Map<string, { count: number; revenue: number }>();
    transactions.forEach(t => {
      const duration = t.services?.duration || 'Unknown';
      const existing = durationData.get(duration) || { count: 0, revenue: 0 };
      durationData.set(duration, {
        count: existing.count + 1,
        revenue: existing.revenue + (t.selling_price || 0)
      });
    });

    const serviceDurationData = Array.from(durationData.entries())
      .map(([duration, data]) => ({ duration, ...data }))
      .sort((a, b) => b.revenue - a.revenue);

    // Profit trends analysis
    const profitTrends = analyzeProfitTrends(monthlyData);

    // Low profit margin services
    const lowProfitServices = Array.from(serviceRevenue.entries())
      .map(([name, data]) => ({
        name,
        ...data,
        margin: data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0
      }))
      .filter(service => service.margin < 15 && service.revenue > 0)
      .sort((a, b) => a.margin - b.margin)
      .slice(0, 3);

    // Process inventory data
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    
    const totalPools = pools.length;
    const activePools = pools.filter(p => p.status === 'active' && p.is_alive).length;
    const expiringSoon = pools.filter(p => {
      const endDate = new Date(p.end_at);
      return endDate >= now && endDate <= threeDaysFromNow && p.status === 'active';
    }).length;
    
    const totalSeats = pools.reduce((sum, p) => sum + p.max_seats, 0);
    const usedSeats = pools.reduce((sum, p) => sum + p.used_seats, 0);
    const utilizationRate = totalSeats > 0 ? (usedSeats / totalSeats) * 100 : 0;
    
    // Pools by provider
    const poolsByProvider = new Map<string, { count: number; seats: number }>();
    pools.forEach(pool => {
      const existing = poolsByProvider.get(pool.provider) || { count: 0, seats: 0 };
      poolsByProvider.set(pool.provider, {
        count: existing.count + 1,
        seats: existing.seats + pool.max_seats
      });
    });
    
    const poolsByProviderArray = Array.from(poolsByProvider.entries())
      .map(([provider, data]) => ({ provider, ...data }))
      .sort((a, b) => b.count - a.count);
    
    // Expiring pools
    const expiringPools = pools
      .filter(p => {
        const endDate = new Date(p.end_at);
        const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysLeft >= 0 && daysLeft <= 7 && p.status === 'active';
      })
      .map(pool => {
        const endDate = new Date(pool.end_at);
        const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return {
          provider: pool.provider,
          login_email: pool.login_email,
          end_at: pool.end_at,
          daysLeft
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);

    return {
      totalRevenue,
      totalProfit,
      totalTransactions,
      totalClients,
      totalServices,
      averageProfitMargin,
      averageTransactionValue,
      topServices,
      monthlyData,
      serviceCategoryData,
      clientTypeData: clientTypeDataArray,
      topClients,
      serviceDurationData,
      profitTrends,
      lowProfitServices,
      inventoryData: {
        totalPools,
        activePools,
        expiringSoon,
        totalSeats,
        usedSeats,
        utilizationRate,
        poolsByProvider: poolsByProviderArray,
        expiringPools
      }
    };
  }, [getMonthlyData, analyzeProfitTrends]);

  const getDateRange = useCallback(() => {
    const now = new Date();
    const from = new Date();
    
    switch (period) {
      case 'month':
        from.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        from.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        from.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    return {
      from: from.toISOString().split('T')[0],
      to: now.toISOString().split('T')[0]
    };
  }, [period]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get date range based on period
      const { from, to } = getDateRange();
      
      const [transactionsResult, servicesResult, clientsResult, poolsResult] = await Promise.all([
        supabase
          .from('transactions')
          .select(`
            *,
            services (
              id,
              product_service,
              category,
              duration
            ),
            client:clients (
              id,
              name,
              type
            )
          `)
          .gte('date', from)
          .lte('date', to)
          .order('date', { ascending: false }),
        supabase
          .from('services')
          .select('*')
          .order('product_service'),
        clientsDb.getAll(),
        listResourcePools()
      ]);

      if (transactionsResult.error) throw transactionsResult.error;
      if (servicesResult.error) throw servicesResult.error;
      if (poolsResult.error) throw poolsResult.error;

      const transactionsData = transactionsResult.data || [];
      const servicesData = servicesResult.data || [];
      const clientsData = clientsResult || [];
      const poolsData = poolsResult.data || [];

      setTransactions(transactionsData);
      setServices(servicesData);
      setClients(clientsData);

      // Process data for reports - memoized
      const processedData = processReportData(transactionsData, servicesData, clientsData, poolsData);
      setReportData(processedData);
      
      // Check for low profit margin alerts
      if (processedData.lowProfitServices.length > 0) {
        setShowLowProfitAlert(true);
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  }, [getDateRange, processReportData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exportReport = () => {
    if (!reportData) return;
    
    const csvContent = [
      ['Metric', 'Value'],
      ['Total Revenue', formatCurrency(reportData.totalRevenue)],
      ['Total Profit', formatCurrency(reportData.totalProfit)],
      ['Total Transactions', reportData.totalTransactions],
      ['Total Clients', reportData.totalClients],
      ['Total Services', reportData.totalServices],
      ['Average Profit Margin', `${reportData.averageProfitMargin.toFixed(2)}%`],
      ['Average Transaction Value', formatCurrency(reportData.averageTransactionValue)],
      [''],
      ['Top Services', 'Revenue', 'Profit', 'Count'],
      ...reportData.topServices.map(s => [s.name, formatCurrency(s.revenue), formatCurrency(s.profit), s.count]),
      [''],
      ['Top Clients', 'Total Spent', 'Transactions', 'Type'],
      ...reportData.topClients.map(c => [c.name, formatCurrency(c.totalSpent), c.transactions, c.type])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reports_${period}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">No data available for reports</p>
      </div>
    );
  }

  const profitTrendsData = {
    labels: reportData.monthlyData.map(d => d.month),
    datasets: [
      {
        label: 'Revenue',
        data: reportData.monthlyData.map(d => d.revenue),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Profit',
        data: reportData.monthlyData.map(d => d.profit),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.4,
      }
    ]
  };

  const servicePerformanceData = {
    labels: reportData.topServices.map(s => s.name),
    datasets: [
      {
        label: 'Revenue',
        data: reportData.topServices.map(s => s.revenue),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(139, 92, 246, 0.8)',
        ],
        borderWidth: 2,
        borderColor: '#1f2937',
      }
    ]
  };

  const categoryDistributionData = {
    labels: reportData.serviceCategoryData.map(c => c.category),
    datasets: [
      {
        data: reportData.serviceCategoryData.map(c => c.revenue),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(139, 92, 246, 0.8)',
        ],
        borderWidth: 2,
        borderColor: '#1f2937',
      }
    ]
  };

  const clientTypeData = {
    labels: reportData.clientTypeData.map(c => c.type === 'client' ? 'Regular Clients' : 'Resellers'),
    datasets: [
      {
        data: reportData.clientTypeData.map(c => c.count),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
        ],
        borderWidth: 2,
        borderColor: '#1f2937',
      }
    ]
  };

  const serviceDurationData = {
    labels: reportData.serviceDurationData.map(d => d.duration),
    datasets: [
      {
        label: 'Revenue',
        data: reportData.serviceDurationData.map(d => d.revenue),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
        ],
        borderWidth: 2,
        borderColor: '#1f2937',
      }
    ]
  };

  return (
    <div>
      <div className="mb-4 lg:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Reports & Analytics</h1>
          <p className="text-gray-400 mt-1 text-sm lg:text-base">Comprehensive business insights and performance metrics</p>
        </div>
        <div className="mt-3 sm:mt-0 flex flex-col sm:flex-row gap-2 sm:gap-3">
          <SearchableDropdown
            options={[
              { value: 'month', label: 'This Month' },
              { value: 'quarter', label: 'This Quarter' },
              { value: 'year', label: 'This Year' }
            ]}
            value={period}
            onChange={(value) => setPeriod(value as 'month' | 'quarter' | 'year')}
            placeholder="Select period"
            className="px-3 py-2 text-sm"
            showSearchThreshold={10}
          />
          <button
            onClick={exportReport}
            className="ghost-button flex items-center justify-center gap-2 px-4 py-2 text-sm"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Low Profit Alert */}
      {showLowProfitAlert && reportData.lowProfitServices.length > 0 && (
        <div className="mb-6 ghost-card p-4 border-l-4 border-yellow-500 bg-yellow-500/10">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <div>
              <h4 className="font-semibold text-yellow-400">Low Profit Margin Alert</h4>
              <p className="text-sm text-gray-300">
                {reportData.lowProfitServices.length} service(s) have profit margins below 15%
              </p>
            </div>
            <button
              onClick={() => setShowLowProfitAlert(false)}
              className="ml-auto text-gray-400 hover:text-white"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
        <div className="ghost-card p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs lg:text-sm">Total Revenue</p>
              <p className="text-lg lg:text-2xl font-bold text-white">{formatCurrency(reportData.totalRevenue)}</p>
            </div>
            <DollarSign className="h-6 w-6 lg:h-8 lg:w-8 text-green-500" />
          </div>
        </div>
        
        <div className="ghost-card p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs lg:text-sm">Total Profit</p>
              <p className="text-lg lg:text-2xl font-bold text-white">{formatCurrency(reportData.totalProfit)}</p>
            </div>
            <TrendingUp className="h-6 w-6 lg:h-8 lg:w-8 text-blue-500" />
          </div>
        </div>
        
        <div className="ghost-card p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs lg:text-sm">Transactions</p>
              <p className="text-lg lg:text-2xl font-bold text-white">{reportData.totalTransactions}</p>
            </div>
            <Package className="h-6 w-6 lg:h-8 lg:w-8 text-purple-500" />
          </div>
        </div>
        
        <div className="ghost-card p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs lg:text-sm">Profit Margin</p>
              <p className="text-lg lg:text-2xl font-bold text-white">{reportData.averageProfitMargin.toFixed(1)}%</p>
            </div>
            <BarChart3 className="h-6 w-6 lg:h-8 lg:w-8 text-yellow-500" />
          </div>
        </div>
      </div>

      {/* Additional Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
        <div className="ghost-card p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs lg:text-sm">Avg Transaction</p>
              <p className="text-lg lg:text-2xl font-bold text-white">{formatCurrency(reportData.averageTransactionValue)}</p>
            </div>
            <Target className="h-6 w-6 lg:h-8 lg:w-8 text-indigo-500" />
          </div>
        </div>
        
        <div className="ghost-card p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs lg:text-sm">Total Clients</p>
              <p className="text-lg lg:text-2xl font-bold text-white">{reportData.totalClients}</p>
            </div>
            <Users className="h-6 w-6 lg:h-8 lg:w-8 text-pink-500" />
          </div>
        </div>
        
        <div className="ghost-card p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs lg:text-sm">Total Services</p>
              <p className="text-lg lg:text-2xl font-bold text-white">{reportData.totalServices}</p>
            </div>
            <Package className="h-6 w-6 lg:h-8 lg:w-8 text-orange-500" />
          </div>
        </div>
        
        <div className="ghost-card p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs lg:text-sm">Profit Trend</p>
              <div className="flex items-center gap-2">
                {reportData.profitTrends.trend === 'up' ? (
                  <TrendingUp className="h-4 w-4 lg:h-5 lg:w-5 text-green-500" />
                ) : reportData.profitTrends.trend === 'down' ? (
                  <TrendingDown className="h-4 w-4 lg:h-5 lg:w-5 text-red-500" />
                ) : (
                  <BarChart3 className="h-4 w-4 lg:h-5 lg:w-5 text-gray-500" />
                )}
                <span className={`text-base lg:text-lg font-bold ${
                  reportData.profitTrends.trend === 'up' ? 'text-green-500' : 
                  reportData.profitTrends.trend === 'down' ? 'text-red-500' : 'text-gray-400'
                }`}>
                  {reportData.profitTrends.trend === 'stable' ? 'Stable' : `${reportData.profitTrends.percentage.toFixed(1)}%`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Metrics */}
      <div className="mb-6 lg:mb-8">
        <h2 className="text-xl lg:text-2xl font-bold text-white mb-4 lg:mb-6 flex items-center gap-2">
          <Archive className="h-6 w-6 text-green-400" />
          Inventory Overview
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <div className="ghost-card p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs lg:text-sm">Total Pools</p>
                <p className="text-lg lg:text-2xl font-bold text-white">{reportData.inventoryData.totalPools}</p>
              </div>
              <Archive className="h-6 w-6 lg:h-8 lg:w-8 text-green-500" />
            </div>
          </div>
          
          <div className="ghost-card p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs lg:text-sm">Active Pools</p>
                <p className="text-lg lg:text-2xl font-bold text-white">{reportData.inventoryData.activePools}</p>
              </div>
              <Clock className="h-6 w-6 lg:h-8 lg:w-8 text-blue-500" />
            </div>
          </div>
          
          <div className="ghost-card p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs lg:text-sm">Expiring Soon</p>
                <p className="text-lg lg:text-2xl font-bold text-white">{reportData.inventoryData.expiringSoon}</p>
              </div>
              <AlertTriangle className="h-6 w-6 lg:h-8 lg:w-8 text-amber-500" />
            </div>
          </div>
          
          <div className="ghost-card p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs lg:text-sm">Seat Utilization</p>
                <p className="text-lg lg:text-2xl font-bold text-white">{reportData.inventoryData.utilizationRate.toFixed(1)}%</p>
                <p className="text-xs text-gray-400">{reportData.inventoryData.usedSeats}/{reportData.inventoryData.totalSeats} seats</p>
              </div>
              <Users className="h-6 w-6 lg:h-8 lg:w-8 text-purple-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
        {/* Profit Trends */}
        <div className="ghost-card p-6 lg:p-8 min-h-[400px] lg:min-h-[500px]">
          <h3 className="text-lg lg:text-xl font-semibold text-white mb-4 lg:mb-6">Profit & Revenue Trends</h3>
          <div className="h-[300px] lg:h-[400px]">
            <Line
              data={profitTrendsData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top' as const,
                    labels: { color: '#9ca3af', font: { size: 12 } }
                  }
                },
                scales: {
                  x: {
                    ticks: { color: '#9ca3af', font: { size: 10 } },
                    grid: { color: '#374151' }
                  },
                  y: {
                    ticks: { color: '#9ca3af', font: { size: 10 } },
                    grid: { color: '#374151' }
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Service Performance */}
        <div className="ghost-card p-6 lg:p-8 min-h-[400px] lg:min-h-[500px]">
          <h3 className="text-lg lg:text-xl font-semibold text-white mb-4 lg:mb-6">Top Services by Revenue</h3>
          <div className="h-[300px] lg:h-[400px]">
            <Bar
              data={servicePerformanceData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: false
                  }
                },
                scales: {
                  x: {
                    ticks: { color: '#9ca3af', font: { size: 10 } },
                    grid: { color: '#374151' }
                  },
                  y: {
                    ticks: { color: '#9ca3af', font: { size: 10 } },
                    grid: { color: '#374151' }
                  }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Additional Charts - Smaller Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
        {/* Category Distribution */}
        <div className="ghost-card p-4 lg:p-6 min-h-[300px] lg:min-h-[350px]">
          <h3 className="text-base lg:text-lg font-semibold text-white mb-3 lg:mb-4">Revenue by Category</h3>
          <div className="h-[200px] lg:h-[250px]">
            <Doughnut
              data={categoryDistributionData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom' as const,
                    labels: { color: '#9ca3af', font: { size: 10 } }
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Client Types */}
        <div className="ghost-card p-4 lg:p-6 min-h-[300px] lg:min-h-[350px]">
          <h3 className="text-base lg:text-lg font-semibold text-white mb-3 lg:mb-4">Client Distribution</h3>
          <div className="h-[200px] lg:h-[250px]">
            <Pie
              data={clientTypeData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom' as const,
                    labels: { color: '#9ca3af', font: { size: 10 } }
                  }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Service Duration Analysis */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
        <div className="ghost-card p-6 lg:p-8 min-h-[350px] lg:min-h-[400px]">
          <h3 className="text-lg lg:text-xl font-semibold text-white mb-4 lg:mb-6">Service Duration Performance</h3>
          <div className="h-[250px] lg:h-[300px]">
            <Bar
              data={serviceDurationData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: false
                  }
                },
                scales: {
                  x: {
                    ticks: { color: '#9ca3af', font: { size: 10 } },
                    grid: { color: '#374151' }
                  },
                  y: {
                    ticks: { color: '#9ca3af', font: { size: 10 } },
                    grid: { color: '#374151' }
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Top Clients */}
        <div className="ghost-card p-6 lg:p-8 min-h-[350px] lg:min-h-[400px]">
          <h3 className="text-lg lg:text-xl font-semibold text-white mb-4 lg:mb-6">Top Clients by Spending</h3>
          <div className="space-y-3 lg:space-y-4">
            {reportData.topClients.map((client, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-2 lg:gap-3">
                  <div className={`w-6 h-6 lg:w-8 lg:h-8 rounded-full flex items-center justify-center text-xs lg:text-sm font-bold ${
                    client.type === 'reseller' ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'
                  }`}>
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm lg:text-base">{client.name}</p>
                    <p className="text-gray-400 text-xs lg:text-sm">{client.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-green-400 font-bold text-sm lg:text-base">{formatCurrency(client.totalSpent)}</p>
                  <p className="text-gray-400 text-xs lg:text-sm">{client.transactions} transactions</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Inventory Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
        {/* Pools by Provider */}
        <div className="ghost-card p-6 lg:p-8 min-h-[350px] lg:min-h-[400px]">
          <h3 className="text-lg lg:text-xl font-semibold text-white mb-4 lg:mb-6">Pools by Provider</h3>
          <div className="h-[250px] lg:h-[300px]">
            <Bar
              data={{
                labels: reportData.inventoryData.poolsByProvider.map(p => p.provider),
                datasets: [
                  {
                    label: 'Pool Count',
                    data: reportData.inventoryData.poolsByProvider.map(p => p.count),
                    backgroundColor: 'rgba(34, 197, 94, 0.8)',
                    borderWidth: 2,
                    borderColor: '#1f2937',
                  }
                ]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: false
                  }
                },
                scales: {
                  x: {
                    ticks: { color: '#9ca3af', font: { size: 10 } },
                    grid: { color: '#374151' }
                  },
                  y: {
                    ticks: { color: '#9ca3af', font: { size: 10 } },
                    grid: { color: '#374151' }
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Seat Utilization */}
        <div className="ghost-card p-6 lg:p-8 min-h-[350px] lg:min-h-[400px]">
          <h3 className="text-lg lg:text-xl font-semibold text-white mb-4 lg:mb-6">Seat Utilization</h3>
          <div className="h-[250px] lg:h-[300px]">
            <Doughnut
              data={{
                labels: ['Used Seats', 'Available Seats'],
                datasets: [
                  {
                    data: [
                      reportData.inventoryData.usedSeats,
                      reportData.inventoryData.totalSeats - reportData.inventoryData.usedSeats
                    ],
                    backgroundColor: [
                      'rgba(34, 197, 94, 0.8)',
                      'rgba(107, 114, 128, 0.8)'
                    ],
                    borderWidth: 2,
                    borderColor: '#1f2937',
                  }
                ]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom' as const,
                    labels: { color: '#9ca3af', font: { size: 10 } }
                  }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Detailed Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
        {/* Top Services Table */}
        <div className="ghost-card p-6 lg:p-8 min-h-[350px] lg:min-h-[400px]">
          <h3 className="text-lg lg:text-xl font-semibold text-white mb-4 lg:mb-6">Top Performing Services</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-400 py-2 lg:py-3 text-xs lg:text-sm font-medium">Service</th>
                  <th className="text-right text-gray-400 py-2 lg:py-3 text-xs lg:text-sm font-medium">Revenue</th>
                  <th className="text-right text-gray-400 py-2 lg:py-3 text-xs lg:text-sm font-medium">Profit</th>
                  <th className="text-right text-gray-400 py-2 lg:py-3 text-xs lg:text-sm font-medium">Count</th>
                </tr>
              </thead>
              <tbody>
                {reportData.topServices.map((service, index) => (
                  <tr key={index} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                    <td className="text-white py-2 lg:py-3 text-xs lg:text-sm">{service.name}</td>
                    <td className="text-right text-green-400 py-2 lg:py-3 text-xs lg:text-sm font-medium">{formatCurrency(service.revenue)}</td>
                    <td className="text-right text-blue-400 py-2 lg:py-3 text-xs lg:text-sm font-medium">{formatCurrency(service.profit)}</td>
                    <td className="text-right text-gray-300 py-2 lg:py-3 text-xs lg:text-sm font-medium">{service.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expiring Pools */}
        <div className="ghost-card p-6 lg:p-8 min-h-[350px] lg:min-h-[400px]">
          <h3 className="text-lg lg:text-xl font-semibold text-white mb-4 lg:mb-6">Pools Expiring Soon</h3>
          <div className="space-y-3 lg:space-y-4">
            {reportData.inventoryData.expiringPools.length > 0 ? (
              reportData.inventoryData.expiringPools.map((pool, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-2 lg:gap-3">
                    <div className="w-6 h-6 lg:w-8 lg:h-8 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs lg:text-sm font-bold">
                      {pool.provider.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm lg:text-base">{pool.provider}</p>
                      <p className="text-gray-400 text-xs lg:text-sm">{pool.login_email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm lg:text-base font-bold ${
                      pool.daysLeft <= 1 ? 'text-red-400' : 
                      pool.daysLeft <= 3 ? 'text-amber-400' : 'text-gray-400'
                    }`}>
                      {pool.daysLeft === 0 ? 'Today' : `${pool.daysLeft} days`}
                    </p>
                    <p className="text-gray-400 text-xs lg:text-sm">
                      {new Date(pool.end_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400">No pools expiring soon</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Low Profit Services Alert */}
      {reportData.lowProfitServices.length > 0 && (
        <div className="mt-8 ghost-card p-6 border-l-4 border-red-500 bg-red-500/10">
          <h3 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Services Requiring Attention
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {reportData.lowProfitServices.map((service, index) => (
              <div key={index} className="p-3 bg-gray-800/50 rounded-lg">
                <p className="text-white font-medium text-sm">{service.name}</p>
                <p className="text-red-400 text-sm">Margin: {service.margin.toFixed(1)}%</p>
                <p className="text-gray-400 text-xs">Revenue: {formatCurrency(service.revenue)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}