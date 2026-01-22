import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Edit, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase, Transaction, Service } from '../lib/supabase';
import TransactionModal from '../components/TransactionModal';
import SearchableDropdown from '../components/SearchableDropdown';
import { getNowInTunisia } from '../lib/dateUtils';
import { useCurrency } from '../lib/currency';

// shadcn/ui components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
        <div className="text-lg text-muted-foreground">Loading transactions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Sales & Expenses</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Track all your transactions and profits</p>
        </div>
        <div className="flex-shrink-0">
          <Button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden xs:inline">Add Transaction</span>
            <span className="xs:hidden">Add</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="animate-fade-in-up">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <div className="w-6 h-6 bg-foreground rounded-full"></div>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total Transactions</p>
                <p className="text-2xl font-bold text-foreground">{filteredTransactions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                <div className="w-6 h-6 bg-foreground rounded-full"></div>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total Revenue</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                <div className="w-6 h-6 bg-red-500 rounded-full"></div>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total Costs</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totalCosts)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <div className={`w-6 h-6 rounded-full ${totalProfit >= 0 ? 'bg-green-400' : 'bg-red-500'}`}></div>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Net Profit</p>
                <p className={`text-2xl font-bold transition-colors ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(totalProfit)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Spotify Player */}
      <Card>
        <CardContent className="p-4">
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
        </CardContent>
      </Card>

      {/* Filter Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[300px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 z-10" />
                <Input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
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
              <label className="block text-xs font-medium text-muted-foreground mb-1">Period</label>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => handleNavigate('prev')}
                  disabled={period === 'all'}
                  className="h-9 w-9"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

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

                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => handleNavigate('next')}
                  disabled={period === 'all'}
                  className="h-9 w-9"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="text-muted-foreground text-xs text-center mt-1">
                {period === 'all' && 'All transactions'}
                {period === 'day' && currentDate.toLocaleDateString()}
                {period === 'week' && `Week of ${currentDate.toLocaleDateString()}`}
                {period === 'month' && currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Selling Price</TableHead>
                <TableHead>Profit</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedTransactions.map((transaction) => {
                const profit = transaction.selling_price - transaction.cost_at_sale;
                return (
                  <TableRow key={transaction.id} className="hover:bg-secondary/50 transition-all">
                    <TableCell className="text-muted-foreground">
                      {new Date(transaction.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">
                        {transaction.services?.product_service}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {transaction.services?.category}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {transaction.services?.duration}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatCurrency(transaction.cost_at_sale)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatCurrency(transaction.selling_price)}</TableCell>
                    <TableCell className={`font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(profit)}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {transaction.notes || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 md:gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingTransaction(transaction);
                            setIsModalOpen(true);
                          }}
                          className="h-8 w-8"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteTransaction(transaction.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {filteredTransactions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="text-muted-foreground text-lg mb-2">
                {searchTerm || selectedService
                  ? 'No transactions found matching your filters.'
                  : 'No transactions yet. Add your first transaction to get started!'}
              </div>
              {!searchTerm && !selectedService && (
                <Button onClick={() => setIsModalOpen(true)} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Transaction
                </Button>
              )}
            </div>
          )}
          {filteredTransactions.length > displayLimit && (
            <div className="p-4 text-center border-t border-border">
              <Button variant="secondary" onClick={() => setDisplayLimit(prev => prev + 100)}>
                Load More ({filteredTransactions.length - displayLimit} remaining)
              </Button>
            </div>
          )}
        </div>
      </Card>

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