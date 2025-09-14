import { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Clock, 
  AlertTriangle, 
  Calendar,
  TrendingUp,
  Users,
  Package,
  ChevronDown,
  ChevronRight,
  X,
  RotateCcw
} from 'lucide-react';
import { Subscription } from '../types/subscription';
import { subscriptionService } from '../lib/subscriptionService';
import { SubscriptionCard } from '../components/SubscriptionCard';
import SubscriptionModal from '../components/SubscriptionModal';
import SubscriptionDetailModal from '../components/SubscriptionDetailModal';
import SearchableDropdown from '../components/SearchableDropdown';
import { formatServiceTitleWithDuration } from '../lib/subscriptionUtils';
import { supabase } from '../lib/supabase';

type ViewMode = 'all' | 'active' | 'completed' | 'archived' | 'dueToday' | 'dueIn3Days' | 'overdue';
type GroupByMode = 'none' | 'client' | 'service';

interface Client {
  id: string;
  name: string;
}

interface Service {
  id: string;
  product_service: string;
  duration?: string;
}

interface GroupedSubscriptions {
  key: string;
  title: string;
  subscriptions: Subscription[];
  counts: {
    active: number;
    completed: number;
    overdue: number;
    archived: number;
  };
}

export default function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [filteredSubscriptions, setFilteredSubscriptions] = useState<Subscription[]>([]);
  const [groupedSubscriptions, setGroupedSubscriptions] = useState<GroupedSubscriptions[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [dueBuckets, setDueBuckets] = useState({ dueToday: 0, dueIn3Days: 0, overdue: 0 });
  
  // Filter state
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [groupBy, setGroupBy] = useState<GroupByMode>('none');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
  
  // Data for selectors
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  
  // UI state
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchSubscriptions();
    fetchDueBuckets();
    loadFiltersFromURL();
  }, []);

  useEffect(() => {
    if (subscriptions.length > 0) {
      fetchClientsAndServices();
    }
  }, [subscriptions]);


  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    applyFilters();
    saveFiltersToURL();
  }, [subscriptions, viewMode, groupBy, selectedClientId, selectedServiceId, debouncedSearchTerm]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' && !event.target || (event.target as Element).tagName === 'BODY') {
        event.preventDefault();
        // Focus the first selector (View dropdown)
        const viewSelect = document.querySelector('input[data-testid]') as HTMLInputElement;
        if (viewSelect) viewSelect.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const loadFiltersFromURL = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view') as ViewMode;
    const group = urlParams.get('groupBy') as GroupByMode;
    const clientId = urlParams.get('clientId') || '';
    const serviceId = urlParams.get('serviceId') || '';

    // Load from URL first, then fallback to localStorage
    if (view && ['all', 'active', 'completed', 'archived', 'dueToday', 'dueIn3Days', 'overdue'].includes(view)) {
      setViewMode(view);
    } else {
      const savedView = localStorage.getItem('subscription-view-mode') as ViewMode;
      if (savedView && ['all', 'active', 'completed', 'archived', 'dueToday', 'dueIn3Days', 'overdue'].includes(savedView)) {
        setViewMode(savedView);
      }
    }

    if (group && ['none', 'client', 'service'].includes(group)) {
      setGroupBy(group);
    } else {
      const savedGroup = localStorage.getItem('subscription-group-by') as GroupByMode;
      if (savedGroup && ['none', 'client', 'service'].includes(savedGroup)) {
        setGroupBy(savedGroup);
      }
    }

    if (clientId) {
      setSelectedClientId(clientId);
    } else {
      const savedClientId = localStorage.getItem('subscription-client-id');
      if (savedClientId) setSelectedClientId(savedClientId);
    }

    if (serviceId) {
      setSelectedServiceId(serviceId);
    } else {
      const savedServiceId = localStorage.getItem('subscription-service-id');
      if (savedServiceId) setSelectedServiceId(savedServiceId);
    }
  };

  const saveFiltersToURL = () => {
    const urlParams = new URLSearchParams();
    if (viewMode !== 'all') urlParams.set('view', viewMode);
    if (groupBy !== 'none') urlParams.set('groupBy', groupBy);
    if (selectedClientId) urlParams.set('clientId', selectedClientId);
    if (selectedServiceId) urlParams.set('serviceId', selectedServiceId);

    const newURL = `${window.location.pathname}${urlParams.toString() ? '?' + urlParams.toString() : ''}`;
    window.history.replaceState({}, '', newURL);

    // Also save to localStorage
    localStorage.setItem('subscription-view-mode', viewMode);
    localStorage.setItem('subscription-group-by', groupBy);
    localStorage.setItem('subscription-client-id', selectedClientId);
    localStorage.setItem('subscription-service-id', selectedServiceId);
  };

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const data = await subscriptionService.listSubscriptions();
      setSubscriptions(data);
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDueBuckets = async () => {
    try {
      const buckets = await subscriptionService.getDueBuckets();
      setDueBuckets(buckets);
    } catch (error) {
      console.error('Error fetching due buckets:', error);
    }
  };

  const fetchClientsAndServices = async () => {
    try {
      // Get unique client and service IDs from subscriptions
      const clientIds = [...new Set(subscriptions.map(s => s.clientId))];
      const serviceIds = [...new Set(subscriptions.map(s => s.serviceId))];

      // Fetch clients with subscriptions
      const { data: clientData } = await supabase
        .from('clients')
        .select('id, name')
        .in('id', clientIds);

      // Fetch services with subscriptions
      const { data: serviceData } = await supabase
        .from('services')
        .select('id, product_service, duration')
        .in('id', serviceIds);

      setClients(clientData || []);
      setServices(serviceData || []);
    } catch (error) {
      console.error('Error fetching clients and services:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...subscriptions];

    // Apply search filter
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      
      filtered = filtered.filter(sub => {
        // Search in service name
        const service = services.find(s => s.id === sub.serviceId);
        const serviceName = service ? formatServiceTitleWithDuration(service.product_service, service.duration || '1 month') : '';
        const serviceMatch = serviceName.toLowerCase().includes(searchLower);
        
        // Search in client name
        const client = clients.find(c => c.id === sub.clientId);
        const clientName = client ? client.name : '';
        const clientMatch = clientName.toLowerCase().includes(searchLower);
        
        // Search in notes
        const notesMatch = sub.notes ? sub.notes.toLowerCase().includes(searchLower) : false;
        
        return serviceMatch || clientMatch || notesMatch;
      });
    }

    // Apply client filter
    if (selectedClientId) {
      filtered = filtered.filter(sub => sub.clientId === selectedClientId);
    }

    // Apply service filter
    if (selectedServiceId) {
      filtered = filtered.filter(sub => sub.serviceId === selectedServiceId);
    }

    // Apply view filter
    const now = new Date();
    switch (viewMode) {
      case 'active':
        filtered = filtered.filter(sub => sub.status === 'active' || sub.status === 'overdue');
        break;
      case 'completed':
        filtered = filtered.filter(sub => sub.status === 'completed');
        break;
      case 'archived':
        filtered = filtered.filter(sub => sub.status === 'archived');
        break;
      case 'dueToday':
        filtered = filtered.filter(sub => {
          if (!sub.nextRenewalAt) return false;
          const renewalDate = new Date(sub.nextRenewalAt);
          return renewalDate.toDateString() === now.toDateString();
        });
        break;
      case 'dueIn3Days':
        filtered = filtered.filter(sub => {
          if (!sub.nextRenewalAt) return false;
          const renewalDate = new Date(sub.nextRenewalAt);
          const diffTime = renewalDate.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return diffDays > 0 && diffDays <= 3;
        });
        break;
      case 'overdue':
        filtered = filtered.filter(sub => {
          if (!sub.nextRenewalAt || sub.status === 'completed') return false;
          const renewalDate = new Date(sub.nextRenewalAt);
          return renewalDate < now;
        });
        break;
    }

    // Sort subscriptions
    filtered.sort((a, b) => {
      // Sort by next renewal date (nulls last)
      if (!a.nextRenewalAt && !b.nextRenewalAt) return 0;
      if (!a.nextRenewalAt) return 1;
      if (!b.nextRenewalAt) return -1;
      
      const dateA = new Date(a.nextRenewalAt);
      const dateB = new Date(b.nextRenewalAt);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA.getTime() - dateB.getTime();
      }
      
      // Then by service name, then client name
      const serviceA = services.find(s => s.id === a.serviceId);
      const serviceB = services.find(s => s.id === b.serviceId);
      const serviceNameA = serviceA ? formatServiceTitleWithDuration(serviceA.product_service, serviceA.duration || '1 month') : '';
      const serviceNameB = serviceB ? formatServiceTitleWithDuration(serviceB.product_service, serviceB.duration || '1 month') : '';
      if (serviceNameA !== serviceNameB) return serviceNameA.localeCompare(serviceNameB);
      
      const clientA = clients.find(c => c.id === a.clientId)?.name || '';
      const clientB = clients.find(c => c.id === b.clientId)?.name || '';
      return clientA.localeCompare(clientB);
    });

    setFilteredSubscriptions(filtered);

    // Apply grouping if needed
    if (groupBy !== 'none') {
      const grouped = groupSubscriptions(filtered, groupBy);
      setGroupedSubscriptions(grouped);
    } else {
      setGroupedSubscriptions([]);
    }
  };

  const groupSubscriptions = (subs: Subscription[], groupMode: 'client' | 'service'): GroupedSubscriptions[] => {
    const groups = new Map<string, GroupedSubscriptions>();

    subs.forEach(sub => {
      let key: string;
      let title: string;

      if (groupMode === 'client') {
        key = sub.clientId;
        title = clients.find(c => c.id === sub.clientId)?.name || 'Unknown Client';
      } else {
        key = sub.serviceId;
        title = services.find(s => s.id === sub.serviceId)?.product_service || 'Unknown Service';
      }

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          title,
          subscriptions: [],
          counts: { active: 0, completed: 0, overdue: 0, archived: 0 }
        });
      }

      const group = groups.get(key)!;
      group.subscriptions.push(sub);
      
      if (sub.status === 'active') group.counts.active++;
      else if (sub.status === 'completed') group.counts.completed++;
      else if (sub.status === 'overdue') group.counts.overdue++;
      else if (sub.status === 'archived') group.counts.archived++;
    });

    // Sort groups alphabetically
    return Array.from(groups.values()).sort((a, b) => a.title.localeCompare(b.title));
  };

  const resetFilters = () => {
    setViewMode('all');
    setGroupBy('none');
    setSelectedClientId('');
    setSelectedServiceId('');
    setSearchTerm('');
    
    // Clear localStorage
    localStorage.removeItem('subscription-view-mode');
    localStorage.removeItem('subscription-group-by');
    localStorage.removeItem('subscription-client-id');
    localStorage.removeItem('subscription-service-id');
  };

  const toggleGroup = (groupKey: string) => {
    const newCollapsed = new Set(collapsedGroups);
    if (newCollapsed.has(groupKey)) {
      newCollapsed.delete(groupKey);
    } else {
      newCollapsed.add(groupKey);
    }
    setCollapsedGroups(newCollapsed);
  };


  const handleSubscriptionCreated = (subscription: Subscription) => {
    setSubscriptions(prev => [subscription, ...prev]);
    fetchDueBuckets();
  };

  const handleSubscriptionView = (subscription: Subscription) => {
    setSelectedSubscription(subscription);
    setIsDetailModalOpen(true);
  };

  const handleSubscriptionEdit = (subscription: Subscription) => {
    setEditingSubscription(subscription);
    setIsModalOpen(true);
  };

  const handleSubscriptionUpdate = (updatedSubscription: Subscription) => {
    setSubscriptions(prev => prev.map(sub => 
      sub.id === updatedSubscription.id ? updatedSubscription : sub
    ));
    fetchDueBuckets();
  };

  const handleSubscriptionDelete = (subscriptionId: string) => {
    setSubscriptions(prev => prev.filter(sub => sub.id !== subscriptionId));
    fetchDueBuckets();
  };

  const getTotalActive = () => {
    return filteredSubscriptions.filter(sub => sub.status === 'active').length;
  };

  const getTotalCompleted = () => {
    return filteredSubscriptions.filter(sub => sub.status === 'completed').length;
  };

  const getTotalArchived = () => {
    return filteredSubscriptions.filter(sub => sub.status === 'archived').length;
  };

  const getFilteredDueBuckets = () => {
    const now = new Date();
    const today = now.toDateString();
    
    return filteredSubscriptions.reduce((buckets, sub) => {
      if (!sub.nextRenewalAt || sub.status === 'completed') return buckets;
      
      const renewalDate = new Date(sub.nextRenewalAt);
      const renewalDateString = renewalDate.toDateString();
      const diffTime = renewalDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (renewalDateString === today) {
        buckets.dueToday++;
      } else if (diffDays > 0 && diffDays <= 3) {
        buckets.dueIn3Days++;
      } else if (renewalDate < now) {
        buckets.overdue++;
      }
      
      return buckets;
    }, { dueToday: 0, dueIn3Days: 0, overdue: 0 });
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading subscriptions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Subscriptions</h1>
          <p className="text-gray-400 mt-1 text-sm sm:text-base">
            Track and manage all your active subscriptions
          </p>
        </div>
        <div className="flex-shrink-0">
          <button
            onClick={() => setIsModalOpen(true)}
            className="ghost-button flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start px-4 py-2.5 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden xs:inline">Create Subscription</span>
            <span className="xs:hidden">Create</span>
          </button>
        </div>
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
                placeholder="Search by service, client, or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-green-500 text-center"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* View Dropdown */}
          <div className="relative">
            <SearchableDropdown
              label="View"
              options={[
                { value: 'all', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'completed', label: 'Completed' },
                { value: 'archived', label: 'Archived' },
                { value: 'dueToday', label: 'Due Today' },
                { value: 'dueIn3Days', label: 'Due in 3 Days' },
                { value: 'overdue', label: 'Overdue' }
              ]}
              value={viewMode}
              onChange={(value) => setViewMode(value as ViewMode)}
              placeholder="Select view"
              className="min-w-[140px]"
              showSearchThreshold={3}
              data-testid="view-dropdown"
            />
          </div>

          {/* Group by Dropdown */}
          <div className="relative">
            <SearchableDropdown
              label="Group by"
              options={[
                { value: 'none', label: 'None' },
                { value: 'client', label: 'Client' },
                { value: 'service', label: 'Service' }
              ]}
              value={groupBy}
              onChange={(value) => setGroupBy(value as GroupByMode)}
              placeholder="Select grouping"
              className="min-w-[120px]"
              showSearchThreshold={3}
            />
          </div>

          {/* Client Selector */}
          <div className="relative client-selector">
            <SearchableDropdown
              label="Client"
              options={[
                { value: '', label: 'All clients' },
                ...clients.map(client => ({
                  value: client.id,
                  label: client.name
                }))
              ]}
              value={selectedClientId}
              onChange={(value) => setSelectedClientId(value)}
              placeholder="All clients"
              searchPlaceholder="Search clients..."
              className="min-w-[160px]"
              allowClear={true}
              onClear={() => setSelectedClientId('')}
              showSearchThreshold={3}
            />
          </div>

          {/* Service Selector */}
          <div className="relative service-selector">
            <SearchableDropdown
              label="Service"
              options={[
                { value: '', label: 'All services' },
                ...services.map(service => ({
                  value: service.id,
                  label: formatServiceTitleWithDuration(service.product_service, service.duration || '1 month')
                }))
              ]}
              value={selectedServiceId}
              onChange={(value) => setSelectedServiceId(value)}
              placeholder="All services"
              searchPlaceholder="Search services..."
              className="min-w-[160px]"
              allowClear={true}
              onClear={() => setSelectedServiceId('')}
              showSearchThreshold={3}
            />
          </div>

          {/* Reset Button */}
          <div className="flex items-end">
            <button
              onClick={resetFilters}
              className="px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Reset all filters"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* KPIs Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {(() => {
          const filteredBuckets = getFilteredDueBuckets();
          return (
            <>
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                    <Clock className="w-6 h-6 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Due Today</p>
                    <p className="text-2xl font-bold text-white">{filteredBuckets.dueToday}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Due in 3 Days</p>
                    <p className="text-2xl font-bold text-white">{filteredBuckets.dueIn3Days}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Overdue</p>
                    <p className="text-2xl font-bold text-white">{filteredBuckets.overdue}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Total Active</p>
                    <p className="text-2xl font-bold text-white">{getTotalActive()}</p>
                  </div>
                </div>
              </div>
            </>
          );
        })()}
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-green-400">{getTotalActive()}</div>
          <div className="text-sm text-gray-400">Active</div>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{getTotalCompleted()}</div>
          <div className="text-sm text-gray-400">Completed</div>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-gray-400">{getTotalArchived()}</div>
          <div className="text-sm text-gray-400">Archived</div>
        </div>
      </div>

      {/* Subscriptions List */}
      <div className="space-y-4">
        {filteredSubscriptions.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No subscriptions match your filters</h3>
            <p className="text-gray-400 mb-4">
              Try resetting filters or selecting a different client/service.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={resetFilters}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors duration-200"
              >
                Reset Filters
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors duration-200"
              >
                Create Subscription
              </button>
            </div>
          </div>
        ) : groupBy !== 'none' ? (
          // Grouped view
          <div className="space-y-6">
            {groupedSubscriptions.map(group => (
              <div key={group.key} className="space-y-3">
                {/* Group Header */}
                <div 
                  className="flex items-center justify-between p-4 bg-gray-800/30 border border-gray-700/50 rounded-xl cursor-pointer hover:bg-gray-800/50 transition-colors"
                  onClick={() => toggleGroup(group.key)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center">
                      {groupBy === 'client' ? <Users className="w-4 h-4 text-gray-400" /> : <Package className="w-4 h-4 text-gray-400" />}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{group.title}</h3>
                      <p className="text-sm text-gray-400">{group.subscriptions.length} subscription{group.subscriptions.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Status chips */}
                    <div className="flex gap-2">
                      <span className="px-2 py-1 bg-green-900/30 text-green-400 text-xs rounded-full">
                        {group.counts.active} Active
                      </span>
                      <span className="px-2 py-1 bg-blue-900/30 text-blue-400 text-xs rounded-full">
                        {group.counts.completed} Completed
                      </span>
                      <span className="px-2 py-1 bg-red-900/30 text-red-400 text-xs rounded-full">
                        {group.counts.overdue} Overdue
                      </span>
                      <span className="px-2 py-1 bg-gray-900/30 text-gray-400 text-xs rounded-full">
                        {group.counts.archived} Archived
                      </span>
                    </div>
                    {collapsedGroups.has(group.key) ? (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
                
                {/* Group Content */}
                {!collapsedGroups.has(group.key) && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 pl-4">
                    {group.subscriptions.map(subscription => (
                      <SubscriptionCard
                        key={subscription.id}
                        subscription={subscription}
                        onUpdate={handleSubscriptionUpdate}
                        onDelete={handleSubscriptionDelete}
                        onView={handleSubscriptionView}
                        onEdit={handleSubscriptionEdit}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          // Ungrouped view
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredSubscriptions.map(subscription => (
              <SubscriptionCard
                key={subscription.id}
                subscription={subscription}
                onUpdate={handleSubscriptionUpdate}
                onDelete={handleSubscriptionDelete}
                onView={handleSubscriptionView}
                onEdit={handleSubscriptionEdit}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Subscription Modal */}
      <SubscriptionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSubscription(null);
        }}
        onSubscriptionCreated={handleSubscriptionCreated}
        onSubscriptionUpdated={handleSubscriptionUpdate}
        editingSubscription={editingSubscription}
      />

             {/* Subscription Detail Modal */}
       <SubscriptionDetailModal
         isOpen={isDetailModalOpen}
         onClose={() => {
           setIsDetailModalOpen(false);
           setSelectedSubscription(null);
         }}
         subscription={selectedSubscription}
         onUpdate={handleSubscriptionUpdate}
         onDelete={handleSubscriptionDelete}
       />

     </div>
   );
 }
