import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Filter, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase, Transaction, Service } from '../lib/supabase';
import TransactionModal from '../components/TransactionModal';
import SearchableDropdown from '../components/SearchableDropdown';

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    fetchData();
  }, [currentDate, period]);

  const getDateRange = () => {
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
  };

  const handlePeriodChange = (newPeriod: 'day' | 'week' | 'month') => {
    setPeriod(newPeriod);
    setCurrentDate(new Date()); // Reset to current date when changing period
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
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

  const fetchData = async () => {
    try {
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
          .gte('date', getDateRange().from)
          .lte('date', getDateRange().to)
          .order('date', { ascending: false }),
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

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = transaction.services?.product_service.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.notes.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesService = selectedService === '' || transaction.service_id === selectedService;
    const currentDateRange = getDateRange();
    const matchesDate = transaction.date >= currentDateRange.from && transaction.date <= currentDateRange.to;
    
    return matchesSearch && matchesService && matchesDate;
  });

  const totalProfit = filteredTransactions.reduce((sum, t) => sum + (t.selling_price - t.cost_at_sale), 0);
  const totalRevenue = filteredTransactions.reduce((sum, t) => sum + t.selling_price, 0);
  const totalCosts = filteredTransactions.reduce((sum, t) => sum + t.cost_at_sale, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-400">Loading transactions...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Sales & Expenses</h1>
          <p className="text-gray-400 mt-1">Track all your transactions and profits</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="ghost-button flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Transaction
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="ghost-card p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Total Transactions</h3>
          <p className="text-3xl font-bold text-green-500">{filteredTransactions.length}</p>
        </div>
        <div className="ghost-card p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Total Revenue</h3>
          <p className="text-3xl font-bold text-blue-500">${totalRevenue.toFixed(2)}</p>
        </div>
        <div className="ghost-card p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Total Costs</h3>
          <p className="text-3xl font-bold text-red-500">${totalCosts.toFixed(2)}</p>
        </div>
        <div className="ghost-card p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Net Profit</h3>
          <p className={`text-3xl font-bold ${totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            ${totalProfit.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="ghost-card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ghost-input pl-10 w-full"
            />
          </div>
          
          <SearchableDropdown
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
            className="w-full"
            showSearchThreshold={5}
          />

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 flex-1">
              <button
                onClick={() => handleNavigate('prev')}
                className="ghost-button-secondary p-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <SearchableDropdown
                options={[
                  { value: 'day', label: 'Today' },
                  { value: 'week', label: 'This Week' },
                  { value: 'month', label: 'This Month' }
                ]}
                value={period}
                onChange={(value) => handlePeriodChange(value as 'day' | 'week' | 'month')}
                placeholder="Select period"
                className="flex-1"
                showSearchThreshold={10}
              />

              <button
                onClick={() => handleNavigate('next')}
                className="ghost-button-secondary p-2"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="text-gray-400 text-sm whitespace-nowrap">
              {period === 'day' && currentDate.toLocaleDateString()}
              {period === 'week' && `Week of ${currentDate.toLocaleDateString()}`}
              {period === 'month' && currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="ghost-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Date</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Service</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Duration</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Cost</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Selling Price</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Profit</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Notes</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredTransactions.map((transaction) => {
                const profit = transaction.selling_price - transaction.cost_at_sale;
                return (
                  <tr key={transaction.id} className="hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 text-gray-300">
                      {new Date(transaction.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-white font-medium">
                      {transaction.services?.product_service}
                      <div className="text-xs text-gray-400">
                        {transaction.services?.category}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-300">
                      {transaction.services?.duration}
                    </td>
                    <td className="px-6 py-4 text-gray-300">${transaction.cost_at_sale.toFixed(2)}</td>
                    <td className="px-6 py-4 text-gray-300">${transaction.selling_price.toFixed(2)}</td>
                    <td className={`px-6 py-4 font-bold ${profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      ${profit.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-gray-300 max-w-xs truncate">
                      {transaction.notes || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingTransaction(transaction);
                            setIsModalOpen(true);
                          }}
                          className="p-2 text-gray-400 hover:text-green-500 transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTransaction(transaction.id)}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
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
            <div className="text-center py-12 text-gray-400">
              {searchTerm || selectedService 
                ? 'No transactions found matching your filters.' 
                : 'No transactions yet. Add your first transaction to get started!'}
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