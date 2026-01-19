import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Edit, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase, Transaction, Service } from '../lib/supabase';
import TransactionModal from '../components/TransactionModal';
import SearchableDropdown from '../components/SearchableDropdown';
import { getNowInTunisia } from '../lib/dateUtils';
import { useCurrency } from '../lib/currency';

export default function Transactions() {
  const { formatCurrency } = useCurrency();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedService, setSelectedService] = useState('');
  // Default to last 30 days instead of 'all' for better performance
  const [period, setPeriod] = useState<'all' | 'day' | 'week' | 'month'>('month');
  const [currentDate, setCurrentDate] = useState(getNowInTunisia());
  // Pagination for large lists
  const [displayLimit, setDisplayLimit] = useState(100);

  // Helper functions defined first
  const getDateRange = useCallback(() => {
    if (period === 'all') {
      return { from: '', to: '' }; // No date filtering for 'all'
    }

    const now = new Date(currentDate);
    now.setUTCHours(0, 0, 0, 0);
    const startOfDay = now;

    switch (period) {
      case 'day':
        return {
          from: startOfDay.toISOString().split('T')[0],
          to: startOfDay.toISOString().split('T')[0]
        };
      case 'week':
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6); // End of week (Saturday)
        return {
          from: startOfWeek.toISOString().split('T')[0],
          to: endOfWeek.toISOString().split('T')[0]
        };
      case 'month':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return {
          from: startOfMonth.toISOString().split('T')[0],
          to: endOfMonth.toISOString().split('T')[0]
        };
      default:
        return { from: '', to: '' };
    }
  }, [period, currentDate]);

  const fetchData = useCallback(async () => {
    try {
      const dateRange = getDateRange();
      let transactionsQuery = supabase
        .from('transactions')
        .select(`
          *,
          services (
            id,
            product_service,
            category,
            duration
          )
        `);

      // Only apply date filtering if not 'all'
      if (dateRange.from && dateRange.to) {
        transactionsQuery = transactionsQuery
          .gte('date', dateRange.from)
          .lte('date', dateRange.to);
      }

      const [transactionsResult, servicesResult] = await Promise.all([
        transactionsQuery.order('date', { ascending: false }),
        supabase
          .from('services')
          .select('*')
          .order('product_service')
      ]);

      if (transactionsResult.error) throw transactionsResult.error;
      if (servicesResult.error) throw servicesResult.error;

      setTransactions(transactionsResult.data || []);
      setServices(servicesResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [getDateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePeriodChange = (newPeriod: 'all' | 'day' | 'week' | 'month') => {
    setPeriod(newPeriod);
    setCurrentDate(getNowInTunisia()); // Reset to current date when changing period
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (period === 'all') return; // No navigation for 'all' period

    const date = new Date(currentDate);
    switch (period) {
      case 'day':
        date.setDate(date.getDate() + (direction === 'next' ? 1 : -1));
        break;
      case 'week':
        date.setDate(date.getDate() + (direction === 'next' ? 7 : -7));
        break;
      case 'month':
        date.setMonth(date.getMonth() + (direction === 'next' ? 1 : -1));
        break;
    }
    setCurrentDate(date);
  };

  const handleSaveTransaction = async (transactionData: Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'services'>) => {
    try {
      const session = await supabase.auth.getSession();
      if (!session) {
        // Try to sign in anonymously if no session exists
        await supabase.auth.signInWithPassword({
          email: 'anonymous@example.com',
          password: 'anonymous'
        });
      }

      if (editingTransaction) {
        const { data, error } = await supabase
          .from('transactions')
          .update({
            ...transactionData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingTransaction.id)
          .select();

        if (error) {
          console.error('Update error details:', error);
          throw error;
        }
        if (data) console.log('Updated transaction:', data);
      } else {
        const { data, error } = await supabase
          .from('transactions')
          .insert([{
            ...transactionData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select();

        if (error) {
          console.error('Insert error details:', error);
          throw error;
        }
        if (data) console.log('Inserted transaction:', data);
      }

      await fetchData();
      setEditingTransaction(null);
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Error saving transaction:', error);
      alert(error.message || 'Error saving transaction');
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    try {
      const { data, error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .select();

      if (error) {
        console.error('Delete error details:', error);
        throw error;
      }
      if (data) console.log('Deleted transaction:', data);

      await fetchData();
    } catch (error: any) {
      console.error('Error deleting transaction:', error);
      alert(error.message || 'Error deleting transaction');
    }
  };

  // Create service lookup map for O(1) lookups
  const serviceMap = useMemo(() => {
    const map = new Map<string, Service>();
    services.forEach(service => map.set(service.id, service));
    return map;
  }, [services]);

  // Memoize filtered transactions
  const filteredTransactions = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    const dateRange = getDateRange();

    return transactions.filter(transaction => {
      const matchesSearch = transaction.services?.product_service.toLowerCase().includes(searchLower) ||
        (transaction.notes || '').toLowerCase().includes(searchLower);
      const matchesService = selectedService === '' || transaction.service_id === selectedService;
      const matchesDate = period === 'all' || (transaction.date >= dateRange.from && transaction.date <= dateRange.to);

      return matchesSearch && matchesService && matchesDate;
    });
  }, [transactions, searchTerm, selectedService, period, getDateRange]);

  // Paginated transactions for display
  const displayedTransactions = useMemo(() => {
    return filteredTransactions.slice(0, displayLimit);
  }, [filteredTransactions, displayLimit]);

  // Reset display limit when filters change
  useEffect(() => {
    setDisplayLimit(100);
  }, [searchTerm, selectedService, period]);

  // Memoize totals
  const totalProfit = useMemo(() => filteredTransactions.reduce((sum, t) => sum + (t.selling_price - t.cost_at_sale), 0), [filteredTransactions]);
  const totalRevenue = useMemo(() => filteredTransactions.reduce((sum, t) => sum + t.selling_price, 0), [filteredTransactions]);
  const totalCosts = useMemo(() => filteredTransactions.reduce((sum, t) => sum + t.cost_at_sale, 0), [filteredTransactions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-400">Loading transactions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Sales & Expenses</h1>
          <p className="text-gray-400 mt-1 text-sm sm:text-base">Track all your transactions and profits</p>
        </div>
        <div className="flex-shrink-0">
          <button
            onClick={() => setIsModalOpen(true)}
            className="ghost-button flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start px-4 py-2.5 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden xs:inline">Add Transaction</span>
            <span className="xs:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
              <div className="w-6 h-6 bg-white rounded-full"></div>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Transactions</p>
              <p className="text-2xl font-bold text-white">{filteredTransactions.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <div className="w-6 h-6 bg-white rounded-full"></div>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Revenue</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(totalRevenue)}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
              <div className="w-6 h-6 bg-red-500 rounded-full"></div>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Costs</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(totalCosts)}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
              <div className={`w-6 h-6 rounded-full ${totalProfit >= 0 ? 'bg-green-400' : 'bg-red-500'}`}></div>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Net Profit</p>
              <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(totalProfit)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Spotify Player */}
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-4">
        <iframe
          data-testid="embed-iframe"
          style={{ borderRadius: '12px' }}
          src="https://open.spotify.com/embed/track/5STdMlrBf6pqWiNE7WqxSi?utm_source=generator&theme=0"
          width="100%"
          height="152"
          frameBorder="0"
          allowFullScreen={true}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      </div>

      {/* Filter Toolbar */}
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-4">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[300px]">
            <label className="block text-xs font-medium text-gray-400 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-white"
              />
            </div>
          </div>

          {/* Service Filter */}
          <div className="relative">
            <SearchableDropdown
              label="Service"
              options={[
                { value: '', label: 'All Services' },
                ...services.map(service => ({
                  value: service.id,
                  label: service.product_service
                }))
              ]}
              value={selectedService}
              onChange={(value) => setSelectedService(value)}
              placeholder="All Services"
              searchPlaceholder="Search services..."
              className="min-w-[160px]"
              showSearchThreshold={3}
              allowClear={true}
              onClear={() => setSelectedService('')}
            />
          </div>

          {/* Period Filter */}
          <div className="relative">
            <label className="block text-xs font-medium text-gray-400 mb-1">Period</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleNavigate('prev')}
                disabled={period === 'all'}
                className={`p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center justify-center ${period === 'all' ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="min-w-[140px]">
                <SearchableDropdown
                  options={[
                    { value: 'all', label: 'All Time' },
                    { value: 'day', label: 'Today' },
                    { value: 'week', label: 'This Week' },
                    { value: 'month', label: 'This Month' }
                  ]}
                  value={period}
                  onChange={(value) => handlePeriodChange(value as 'all' | 'day' | 'week' | 'month')}
                  placeholder="Select period"
                  className="w-full"
                  showSearchThreshold={3}
                />
              </div>

              <button
                onClick={() => handleNavigate('next')}
                disabled={period === 'all'}
                className={`p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center justify-center ${period === 'all' ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="text-gray-400 text-xs text-center mt-1">
              {period === 'all' && 'All transactions'}
              {period === 'day' && currentDate.toLocaleDateString()}
              {period === 'week' && `Week of ${currentDate.toLocaleDateString()}`}
              {period === 'month' && currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-700/50 relative z-10">
              <tr>
                <th className="px-4 md:px-6 py-4 text-left text-sm font-medium text-gray-300">Date</th>
                <th className="px-4 md:px-6 py-4 text-left text-sm font-medium text-gray-300">Service</th>
                <th className="px-4 md:px-6 py-4 text-left text-sm font-medium text-gray-300">Duration</th>
                <th className="px-4 md:px-6 py-4 text-left text-sm font-medium text-gray-300">Cost</th>
                <th className="px-4 md:px-6 py-4 text-left text-sm font-medium text-gray-300">Selling Price</th>
                <th className="px-4 md:px-6 py-4 text-left text-sm font-medium text-gray-300">Profit</th>
                <th className="px-4 md:px-6 py-4 text-left text-sm font-medium text-gray-300">Notes</th>
                <th className="px-4 md:px-6 py-4 text-left text-sm font-medium text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {displayedTransactions.map((transaction) => {
                const profit = transaction.selling_price - transaction.cost_at_sale;
                return (
                  <tr key={transaction.id} className="hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 md:px-6 py-4 text-gray-300 text-sm">
                      {new Date(transaction.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 md:px-6 py-4 text-white font-medium">
                      <div className="text-sm md:text-base">
                        {transaction.services?.product_service}
                      </div>
                      <div className="text-xs text-gray-400">
                        {transaction.services?.category}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 text-gray-300 text-sm">
                      {transaction.services?.duration}
                    </td>
                    <td className="px-4 md:px-6 py-4 text-gray-300 text-sm">{formatCurrency(transaction.cost_at_sale)}</td>
                    <td className="px-4 md:px-6 py-4 text-gray-300 text-sm">{formatCurrency(transaction.selling_price)}</td>
                    <td className={`px-4 md:px-6 py-4 font-bold text-sm ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(profit)}
                    </td>
                    <td className="px-4 md:px-6 py-4 text-gray-300 text-sm max-w-xs truncate">
                      {transaction.notes || '-'}
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <div className="flex gap-1 md:gap-2">
                        <button
                          onClick={() => {
                            setEditingTransaction(transaction);
                            setIsModalOpen(true);
                          }}
                          className="p-1 md:p-2 text-gray-400 hover:text-white transition-colors rounded"
                          title="Edit transaction"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTransaction(transaction.id)}
                          className="p-1 md:p-2 text-gray-400 hover:text-red-500 transition-colors rounded"
                          title="Delete transaction"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredTransactions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="text-gray-400 text-lg mb-2">
                {searchTerm || selectedService
                  ? 'No transactions found matching your filters.'
                  : 'No transactions yet. Add your first transaction to get started!'}
              </div>
              {!searchTerm && !selectedService && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="ghost-button mt-4"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Transaction
                </button>
              )}
            </div>
          )}
          {filteredTransactions.length > displayLimit && (
            <div className="p-4 text-center border-t border-gray-700/50">
              <button
                onClick={() => setDisplayLimit(prev => prev + 100)}
                className="ghost-button"
              >
                Load More ({filteredTransactions.length - displayLimit} remaining)
              </button>
            </div>
          )}
        </div>
      </div>

      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTransaction(null);
        }}
        onSave={handleSaveTransaction}
        transaction={editingTransaction}
        services={services}
      />
    </div>
  );
}