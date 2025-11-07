import { useState, useEffect, useRef, useCallback } from 'react';
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
  RotateCcw,
  Archive,
  Download,
  Keyboard,
  HelpCircle
} from 'lucide-react';
import { Subscription } from '../types/subscription';
import { subscriptionService } from '../lib/subscriptionService';
import { SubscriptionCard } from '../components/SubscriptionCard';
import SubscriptionModal from '../components/SubscriptionModal';
import SubscriptionDetailModal from '../components/SubscriptionDetailModal';
import SubscriptionEditModal from '../components/SubscriptionEditModal';
import SearchableDropdown from '../components/SearchableDropdown';
import { formatServiceTitleWithDuration, groupServicesByBaseName, getAvailablePeriods, ServiceGroup } from '../lib/subscriptionUtils';
import { supabase } from '../lib/supabase';
import { useKeyboardShortcuts, shouldIgnoreKeyboardEvent } from '../lib/useKeyboardShortcuts';
import { syncSubscriptionsForDeadPools, getResourcePool } from '../lib/inventory';
import { ResourcePool } from '../types/inventory';

type ViewMode = 'all' | 'active' | 'completed' | 'dueToday' | 'dueIn3Days' | 'overdue' | 'overdueNormal' | 'overdueDeadPool';
type ArchiveViewMode = 'subscriptions' | 'archive';
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
  const [archivedSubscriptions, setArchivedSubscriptions] = useState<Subscription[]>([]);
  const [filteredSubscriptions, setFilteredSubscriptions] = useState<Subscription[]>([]);
  const [filteredArchivedSubscriptions, setFilteredArchivedSubscriptions] = useState<Subscription[]>([]);
  const [groupedSubscriptions, setGroupedSubscriptions] = useState<GroupedSubscriptions[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [dueBuckets, setDueBuckets] = useState({ dueToday: 0, dueIn3Days: 0, overdue: 0 });
  
  // Archive view state
  const [archiveViewMode, setArchiveViewMode] = useState<ArchiveViewMode>('subscriptions');
  
  // Filter state
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [groupBy, setGroupBy] = useState<GroupByMode>('none');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedServiceGroup, setSelectedServiceGroup] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
  
  // Data for selectors
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceGroups, setServiceGroups] = useState<ServiceGroup[]>([]);
  
  // Pool data cache for checking dead pool status
  const [poolCache, setPoolCache] = useState<Map<string, ResourcePool>>(new Map());
  
  // UI state
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedCardIndex, setSelectedCardIndex] = useState<number>(-1);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const initializeData = async () => {
      // First sync subscriptions linked to dead pools
      await syncSubscriptionsForDeadPools();
      // Then fetch subscriptions
      await fetchSubscriptions();
      await fetchArchivedSubscriptions();
      await fetchDueBuckets();
      loadFiltersFromURL();
      
      // Refresh subscription statuses to auto-complete expired subscriptions
      refreshSubscriptionStatus();
    };
    
    initializeData();
  }, []);

  // Add a manual refresh function for debugging
  const handleManualRefresh = async () => {
    console.log('Manual refresh triggered');
    await fetchSubscriptions(true);
    await fetchArchivedSubscriptions(true);
    await fetchDueBuckets();
  };

  // Fetch pool data for subscriptions that have resourcePoolId
  const fetchPoolDataForSubscriptions = useCallback(async () => {
    const poolIds = [...new Set(subscriptions
      .filter(sub => sub.resourcePoolId)
      .map(sub => sub.resourcePoolId!)
    )];
    
    if (poolIds.length === 0) {
      setPoolCache(new Map());
      return;
    }
    
    try {
      // Filter out pools that are already in cache
      setPoolCache(currentCache => {
        const poolsToFetch = poolIds.filter(poolId => !currentCache.has(poolId));
        
        if (poolsToFetch.length === 0) {
          // All pools already in cache
          return currentCache;
        }
        
        // Fetch pools that aren't in cache
        const poolPromises = poolsToFetch.map(async (poolId) => {
          const { data: pool, error } = await getResourcePool(poolId);
          if (error || !pool) return null;
          return { poolId, pool };
        });
        
        Promise.all(poolPromises).then(results => {
          setPoolCache(prevCache => {
            const newCache = new Map(prevCache);
            results.forEach(result => {
              if (result) {
                newCache.set(result.poolId, result.pool);
              }
            });
            return newCache;
          });
        });
        
        return currentCache;
      });
    } catch (error) {
      console.error('Error fetching pool data:', error);
    }
  }, [subscriptions]);

  useEffect(() => {
    if (subscriptions.length > 0) {
      fetchClientsAndServices();
      fetchPoolDataForSubscriptions();
    }
  }, [subscriptions, fetchPoolDataForSubscriptions]);


  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (archiveViewMode === 'subscriptions') {
      applyFilters();
    } else {
      applyArchiveFilters();
    }
    saveFiltersToURL();
  }, [subscriptions, archivedSubscriptions, viewMode, groupBy, selectedClientId, selectedServiceId, selectedServiceGroup, selectedPeriod, debouncedSearchTerm, archiveViewMode, poolCache]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'n',
        handler: () => {
          if (!isModalOpen && !isDetailModalOpen && !isEditModalOpen) {
            setIsModalOpen(true);
          }
        },
        description: 'Create new subscription',
      },
      {
        key: 'c',
        handler: () => {
          if (!isModalOpen && !isDetailModalOpen && !isEditModalOpen) {
            setIsModalOpen(true);
          }
        },
        description: 'Create new subscription',
      },
      {
        key: '/',
        handler: () => {
          if (searchInputRef.current) {
            searchInputRef.current.focus();
            searchInputRef.current.select();
          }
        },
        description: 'Focus search',
      },
      {
        key: 'f',
        handler: () => {
          if (searchInputRef.current) {
            searchInputRef.current.focus();
            searchInputRef.current.select();
          }
        },
        description: 'Focus search',
        ctrl: true,
      },
      {
        key: 'e',
        handler: () => {
          if (!isModalOpen && !isDetailModalOpen && !isEditModalOpen) {
            exportSubscriptions();
          }
        },
        description: 'Export subscriptions',
      },
      {
        key: 'r',
        handler: () => {
          if (!isModalOpen && !isDetailModalOpen && !isEditModalOpen) {
            resetFilters();
          }
        },
        description: 'Reset filters',
      },
      {
        key: 'a',
        handler: () => {
          if (!isModalOpen && !isDetailModalOpen && !isEditModalOpen) {
            setArchiveViewMode(prev => prev === 'subscriptions' ? 'archive' : 'subscriptions');
          }
        },
        description: 'Toggle archive view',
      },
      {
        key: 'Escape',
        handler: () => {
          if (isEditModalOpen) {
            setIsEditModalOpen(false);
            setEditingSubscription(null);
            setIsDetailModalOpen(false);
            setSelectedSubscription(null);
          } else if (isDetailModalOpen) {
            setIsDetailModalOpen(false);
            setSelectedSubscription(null);
          } else if (isModalOpen) {
            setIsModalOpen(false);
            setEditingSubscription(null);
          } else if (showKeyboardHelp) {
            setShowKeyboardHelp(false);
          } else {
            setSelectedCardIndex(-1);
          }
        },
        description: 'Close modal or deselect',
      },
      {
        key: 'ArrowDown',
        handler: () => {
          if (isModalOpen || isDetailModalOpen || isEditModalOpen) return;
          const currentSubs = archiveViewMode === 'subscriptions' ? filteredSubscriptions : filteredArchivedSubscriptions;
          if (currentSubs.length === 0) return;
          
          setSelectedCardIndex(prev => {
            const nextIndex = prev < currentSubs.length - 1 ? prev + 1 : prev;
            // Scroll into view
            setTimeout(() => {
              if (cardRefs.current[nextIndex]) {
                cardRefs.current[nextIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }
            }, 0);
            return nextIndex;
          });
        },
        description: 'Navigate down',
      },
      {
        key: 'ArrowUp',
        handler: () => {
          if (isModalOpen || isDetailModalOpen || isEditModalOpen) return;
          const currentSubs = archiveViewMode === 'subscriptions' ? filteredSubscriptions : filteredArchivedSubscriptions;
          if (currentSubs.length === 0) return;
          
          setSelectedCardIndex(prev => {
            const nextIndex = prev > 0 ? prev - 1 : 0;
            // Scroll into view
            setTimeout(() => {
              if (cardRefs.current[nextIndex]) {
                cardRefs.current[nextIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }
            }, 0);
            return nextIndex;
          });
        },
        description: 'Navigate up',
      },
      {
        key: 'Enter',
        handler: () => {
          if (isModalOpen || isDetailModalOpen || isEditModalOpen) return;
          const currentSubs = archiveViewMode === 'subscriptions' ? filteredSubscriptions : filteredArchivedSubscriptions;
          if (selectedCardIndex >= 0 && selectedCardIndex < currentSubs.length) {
            const subscription = currentSubs[selectedCardIndex];
            handleSubscriptionView(subscription);
          }
        },
        description: 'Open selected subscription',
      },
      {
        key: '?',
        handler: () => {
          setShowKeyboardHelp(prev => !prev);
        },
        description: 'Show keyboard shortcuts help',
        shift: true,
      },
      // Quick view filters (1-6)
      {
        key: '1',
        handler: () => {
          if (!isModalOpen && !isDetailModalOpen && !isEditModalOpen) {
            setViewMode('all');
          }
        },
        description: 'View: All',
      },
      {
        key: '2',
        handler: () => {
          if (!isModalOpen && !isDetailModalOpen && !isEditModalOpen) {
            setViewMode('active');
          }
        },
        description: 'View: Active',
      },
      {
        key: '3',
        handler: () => {
          if (!isModalOpen && !isDetailModalOpen && !isEditModalOpen) {
            setViewMode('completed');
          }
        },
        description: 'View: Completed',
      },
      {
        key: '4',
        handler: () => {
          if (!isModalOpen && !isDetailModalOpen && !isEditModalOpen) {
            setViewMode('dueToday');
          }
        },
        description: 'View: Due Today',
      },
      {
        key: '5',
        handler: () => {
          if (!isModalOpen && !isDetailModalOpen && !isEditModalOpen) {
            setViewMode('dueIn3Days');
          }
        },
        description: 'View: Due in 3 Days',
      },
      {
        key: '6',
        handler: () => {
          if (!isModalOpen && !isDetailModalOpen && !isEditModalOpen) {
            setViewMode('overdue');
          }
        },
        description: 'View: Overdue',
      },
    ],
    enabled: true,
    ignoreWhen: shouldIgnoreKeyboardEvent,
  });

  // Reset selected card index when filters change and resize card refs array
  useEffect(() => {
    setSelectedCardIndex(-1);
    const currentSubs = archiveViewMode === 'subscriptions' ? filteredSubscriptions : filteredArchivedSubscriptions;
    cardRefs.current = new Array(currentSubs.length).fill(null);
  }, [filteredSubscriptions, filteredArchivedSubscriptions, archiveViewMode]);

  const loadFiltersFromURL = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view') as ViewMode;
    const group = urlParams.get('groupBy') as GroupByMode;
    const clientId = urlParams.get('clientId') || '';
    const serviceId = urlParams.get('serviceId') || '';
    const serviceGroup = urlParams.get('serviceGroup') || '';
    const period = urlParams.get('period') || '';
    const archiveView = urlParams.get('archiveView') as ArchiveViewMode;

    // Load archive view mode
    if (archiveView && ['subscriptions', 'archive'].includes(archiveView)) {
      setArchiveViewMode(archiveView);
    } else {
      const savedArchiveView = localStorage.getItem('subscription-archive-view-mode') as ArchiveViewMode;
      if (savedArchiveView && ['subscriptions', 'archive'].includes(savedArchiveView)) {
        setArchiveViewMode(savedArchiveView);
      }
    }

    // Load from URL first, then fallback to localStorage
    if (view && ['all', 'active', 'completed', 'dueToday', 'dueIn3Days', 'overdue', 'overdueNormal', 'overdueDeadPool'].includes(view)) {
      setViewMode(view);
    } else {
      const savedView = localStorage.getItem('subscription-view-mode') as ViewMode;
      if (savedView && ['all', 'active', 'completed', 'dueToday', 'dueIn3Days', 'overdue', 'overdueNormal', 'overdueDeadPool'].includes(savedView)) {
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

    if (serviceGroup) {
      setSelectedServiceGroup(serviceGroup);
    } else {
      const savedServiceGroup = localStorage.getItem('subscription-service-group');
      if (savedServiceGroup) setSelectedServiceGroup(savedServiceGroup);
    }

    if (period) {
      setSelectedPeriod(period);
    } else {
      const savedPeriod = localStorage.getItem('subscription-period');
      if (savedPeriod) setSelectedPeriod(savedPeriod);
    }
  };

  const saveFiltersToURL = () => {
    const urlParams = new URLSearchParams();
    if (archiveViewMode !== 'subscriptions') urlParams.set('archiveView', archiveViewMode);
    if (viewMode !== 'all') urlParams.set('view', viewMode);
    if (groupBy !== 'none') urlParams.set('groupBy', groupBy);
    if (selectedClientId) urlParams.set('clientId', selectedClientId);
    if (selectedServiceId) urlParams.set('serviceId', selectedServiceId);
    if (selectedServiceGroup) urlParams.set('serviceGroup', selectedServiceGroup);
    if (selectedPeriod) urlParams.set('period', selectedPeriod);

    const newURL = `${window.location.pathname}${urlParams.toString() ? '?' + urlParams.toString() : ''}`;
    window.history.replaceState({}, '', newURL);

    // Also save to localStorage
    localStorage.setItem('subscription-archive-view-mode', archiveViewMode);
    localStorage.setItem('subscription-view-mode', viewMode);
    localStorage.setItem('subscription-group-by', groupBy);
    localStorage.setItem('subscription-client-id', selectedClientId);
    localStorage.setItem('subscription-service-id', selectedServiceId);
    localStorage.setItem('subscription-service-group', selectedServiceGroup);
    localStorage.setItem('subscription-period', selectedPeriod);
  };

  const fetchSubscriptions = async (forceRefresh = false) => {
    try {
      setLoading(true);
      if (forceRefresh) {
        console.log('Force refreshing subscriptions from database...');
      }
      const data = await subscriptionService.listSubscriptions();
      console.log('Fetched subscriptions:', data.length, 'records');
      // Filter out archived subscriptions (but include completed subscriptions)
      const activeSubscriptions = data.filter(sub => sub.status !== 'archived');
      setSubscriptions(activeSubscriptions);
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchArchivedSubscriptions = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        console.log('Force refreshing archived subscriptions from database...');
      }
      const data = await subscriptionService.listSubscriptions();
      console.log('Fetched archived subscriptions:', data.length, 'records');
      // Filter only archived subscriptions
      const archivedSubs = data.filter(sub => sub.status === 'archived');
      setArchivedSubscriptions(archivedSubs);
    } catch (error) {
      console.error('Error fetching archived subscriptions:', error);
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

  const refreshSubscriptionStatus = async () => {
    try {
      const result = await subscriptionService.refreshSubscriptionStatus();
      if (result.completedCount > 0 || result.overdueCount > 0) {
        // Refresh subscriptions if any were updated
        await fetchSubscriptions(true);
        await fetchArchivedSubscriptions(true);
        await fetchDueBuckets();
      }
    } catch (error) {
      console.error('Error refreshing subscription status:', error);
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
      
      // Create service groups
      if (serviceData) {
        const groups = groupServicesByBaseName(serviceData);
        setServiceGroups(groups);
      }
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

    // Apply service filter (either by specific service ID or by service group + period)
    if (selectedServiceId) {
      filtered = filtered.filter(sub => sub.serviceId === selectedServiceId);
    } else if (selectedServiceGroup && selectedPeriod) {
      // Filter by specific service group and period combination
      filtered = filtered.filter(sub => sub.serviceId === selectedPeriod);
    } else if (selectedServiceGroup) {
      // Filter by service group (all periods for that service)
      const group = serviceGroups.find(g => g.baseName === selectedServiceGroup);
      if (group) {
        const serviceIds = group.services.map(s => s.id);
        filtered = filtered.filter(sub => serviceIds.includes(sub.serviceId));
      }
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
      case 'overdueNormal':
        filtered = filtered.filter(sub => {
          if (!sub.nextRenewalAt || sub.status === 'completed') return false;
          const renewalDate = new Date(sub.nextRenewalAt);
          if (renewalDate >= now) return false;
          
          // Check if it's NOT overdue from dead pool
          if (sub.resourcePoolId) {
            const pool = poolCache.get(sub.resourcePoolId);
            if (pool && !pool.is_alive) {
              return false; // This is overdue from dead pool, exclude it
            }
          }
          return true;
        });
        break;
      case 'overdueDeadPool':
        filtered = filtered.filter(sub => {
          if (!sub.nextRenewalAt || sub.status === 'completed') return false;
          const renewalDate = new Date(sub.nextRenewalAt);
          if (renewalDate >= now) return false;
          
          // Check if it's overdue from dead pool
          if (sub.resourcePoolId) {
            const pool = poolCache.get(sub.resourcePoolId);
            if (pool && !pool.is_alive) {
              return true; // This is overdue from dead pool
            }
          }
          return false; // Not overdue from dead pool
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

  const applyArchiveFilters = () => {
    let filtered = [...archivedSubscriptions];

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

    // Apply service filter (either by specific service ID or by service group + period)
    if (selectedServiceId) {
      filtered = filtered.filter(sub => sub.serviceId === selectedServiceId);
    } else if (selectedServiceGroup && selectedPeriod) {
      // Filter by specific service group and period combination
      filtered = filtered.filter(sub => sub.serviceId === selectedPeriod);
    } else if (selectedServiceGroup) {
      // Filter by service group (all periods for that service)
      const group = serviceGroups.find(g => g.baseName === selectedServiceGroup);
      if (group) {
        const serviceIds = group.services.map(s => s.id);
        filtered = filtered.filter(sub => serviceIds.includes(sub.serviceId));
      }
    }

    // Sort archived subscriptions by archive date (most recent first)
    filtered.sort((a, b) => {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    setFilteredArchivedSubscriptions(filtered);
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
    setSelectedServiceGroup('');
    setSelectedPeriod('');
    setSearchTerm('');
    setArchiveViewMode('subscriptions');
    
    // Clear localStorage
    localStorage.removeItem('subscription-view-mode');
    localStorage.removeItem('subscription-group-by');
    localStorage.removeItem('subscription-client-id');
    localStorage.removeItem('subscription-service-id');
    localStorage.removeItem('subscription-service-group');
    localStorage.removeItem('subscription-period');
    localStorage.removeItem('subscription-archive-view-mode');
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

  // Handler for service group selection
  const handleServiceGroupChange = (serviceGroup: string) => {
    setSelectedServiceGroup(serviceGroup);
    // Clear period selection when service group changes
    setSelectedPeriod('');
    // Clear specific service selection
    setSelectedServiceId('');
  };

  // Handler for period selection
  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
    // Clear specific service selection when period is selected
    setSelectedServiceId('');
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
    setIsEditModalOpen(true);
  };

  const handleSubscriptionUpdate = (updatedSubscription: Subscription) => {
    console.log('📝 Handling subscription update:', updatedSubscription.id, 'Status:', updatedSubscription.status);
    
    // Handle status changes that affect which list the subscription belongs to
    if (updatedSubscription.status === 'archived') {
      // Move from active to archived
      setSubscriptions(prev => {
        const filtered = prev.filter(sub => sub.id !== updatedSubscription.id);
        console.log('📦 Moved subscription to archived list, active count:', filtered.length);
        return filtered;
      });
      setArchivedSubscriptions(prev => {
        const updated = prev.map(sub => 
          sub.id === updatedSubscription.id ? updatedSubscription : sub
        );
        // If it's not already in archived list, add it
        if (!prev.find(sub => sub.id === updatedSubscription.id)) {
          updated.push(updatedSubscription);
        }
        console.log('📦 Updated archived list, archived count:', updated.length);
        return updated;
      });
    } else {
      // Move from archived to active (or update active subscription)
      setArchivedSubscriptions(prev => {
        const filtered = prev.filter(sub => sub.id !== updatedSubscription.id);
        console.log('📦 Moved subscription from archived to active, archived count:', filtered.length);
        return filtered;
      });
      setSubscriptions(prev => {
        const updated = prev.map(sub => 
          sub.id === updatedSubscription.id ? updatedSubscription : sub
        );
        // If it's not already in active list, add it
        if (!prev.find(sub => sub.id === updatedSubscription.id)) {
          updated.push(updatedSubscription);
        }
        console.log('📦 Updated active list, active count:', updated.length);
        return updated;
      });
    }
    
    fetchDueBuckets();
  };

  const handleSubscriptionDelete = async (subscriptionId: string) => {
    console.log('🗑️ Handling subscription deletion:', subscriptionId);
    
    // Immediately remove from local state for responsive UI
    setSubscriptions(prev => {
      const filtered = prev.filter(sub => sub.id !== subscriptionId);
      console.log('Local state updated - removed subscription, remaining count:', filtered.length);
      return filtered;
    });
    setArchivedSubscriptions(prev => {
      const filtered = prev.filter(sub => sub.id !== subscriptionId);
      return filtered;
    });
    
    // Close any open modals
    setIsDetailModalOpen(false);
    setIsEditModalOpen(false);
    setSelectedSubscription(null);
    setEditingSubscription(null);
    
    // Force refresh from database to ensure consistency
    setTimeout(async () => {
      console.log('🔄 Force refreshing subscriptions after deletion...');
      try {
        const data = await subscriptionService.listSubscriptions();
        console.log('📊 Database refresh complete - subscription count:', data.length);
        
        // Check if the deleted subscription still exists in the fresh data
        const stillExists = data.find(sub => sub.id === subscriptionId);
        if (stillExists) {
          console.error('⚠️ CRITICAL: Deleted subscription still exists in database!', stillExists);
          // Don't show alert anymore since we fixed the card deletion
        } else {
          console.log('✅ Confirmed: Subscription successfully removed from database');
        }
        
        // Filter active and archived subscriptions
        const activeSubscriptions = data.filter(sub => sub.status !== 'archived');
        const archivedSubs = data.filter(sub => sub.status === 'archived');
        setSubscriptions(activeSubscriptions);
        setArchivedSubscriptions(archivedSubs);
      } catch (error) {
        console.error('❌ Error refreshing subscriptions after deletion:', error);
      }
    }, 1000); // Increased delay to ensure database operations are complete
    
    fetchDueBuckets();
  };

  const getTotalActive = () => {
    return filteredSubscriptions.filter(sub => sub.status === 'active').length;
  };

  const getTotalCompleted = () => {
    return filteredSubscriptions.filter(sub => sub.status === 'completed').length;
  };

  const getTotalOverdue = () => {
    const now = new Date();
    return filteredSubscriptions.filter(sub => {
      if (!sub.nextRenewalAt || sub.status === 'completed') return false;
      const renewalDate = new Date(sub.nextRenewalAt);
      return renewalDate < now;
    }).length;
  };

  const getTotalArchived = () => {
    return archiveViewMode === 'archive' ? filteredArchivedSubscriptions.length : archivedSubscriptions.length;
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

  const exportSubscriptions = () => {
    const now = new Date();
    const subscriptionsToExport = archiveViewMode === 'subscriptions' ? filteredSubscriptions : filteredArchivedSubscriptions;
    
    // Prepare CSV data
    const csvData = subscriptionsToExport.map(subscription => {
      const client = clients.find(c => c.id === subscription.clientId);
      const service = services.find(s => s.id === subscription.serviceId);
      const clientName = client ? client.name : 'Unknown Client';
      const serviceName = service ? formatServiceTitleWithDuration(service.product_service, service.duration || '1 month') : 'Unknown Service';
      
      // Calculate elapsed days since start
      const startDate = new Date(subscription.startedAt);
      const elapsedDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Calculate days remaining
      let daysRemaining = '';
      if (subscription.nextRenewalAt) {
        const renewalDate = new Date(subscription.nextRenewalAt);
        const remainingMs = renewalDate.getTime() - now.getTime();
        const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
        daysRemaining = remainingDays > 0 ? remainingDays.toString() : 'Overdue';
      } else if (subscription.targetEndAt) {
        const endDate = new Date(subscription.targetEndAt);
        const remainingMs = endDate.getTime() - now.getTime();
        const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
        daysRemaining = remainingDays > 0 ? remainingDays.toString() : 'Completed';
      } else {
        daysRemaining = 'N/A';
      }
      
      // Format dates
      const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
      };
      
      return {
        'Subscription ID': subscription.id,
        'Client Name': clientName,
        'Service Name': serviceName,
        'Status': subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1),
        'Start Date': formatDate(subscription.startedAt),
        'Next Renewal Date': subscription.nextRenewalAt ? formatDate(subscription.nextRenewalAt) : 'N/A',
        'Target End Date': subscription.targetEndAt ? formatDate(subscription.targetEndAt) : 'N/A',
        'Days Elapsed': elapsedDays.toString(),
        'Days Remaining': daysRemaining,
        'Renewal Strategy': subscription.strategy,
        'Iterations Done': subscription.iterationsDone?.toString() || '0',
        'Notes': subscription.notes || '',
        'Created At': formatDate(subscription.createdAt),
        'Updated At': formatDate(subscription.updatedAt)
      };
    });
    
    // Convert to CSV
    if (csvData.length === 0) {
      alert('No subscriptions to export');
      return;
    }
    
    const headers = Object.keys(csvData[0]);
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => 
        headers.map(header => {
          const value = row[header as keyof typeof row];
          // Escape commas and quotes in CSV
          return typeof value === 'string' && (value.includes(',') || value.includes('"')) 
            ? `"${value.replace(/"/g, '""')}"` 
            : value;
        }).join(',')
      )
    ].join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filterSuffix = archiveViewMode === 'archive' ? '_archived' : '';
    const viewSuffix = viewMode !== 'all' ? `_${viewMode}` : '';
    const clientSuffix = selectedClientId ? `_client_${clients.find(c => c.id === selectedClientId)?.name.replace(/\s+/g, '_') || 'unknown'}` : '';
    const serviceSuffix = selectedServiceGroup ? `_service_${selectedServiceGroup.replace(/\s+/g, '_')}` : '';
    
    link.setAttribute('download', `subscriptions${filterSuffix}${viewSuffix}${clientSuffix}${serviceSuffix}_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        <div className="flex-shrink-0 flex gap-2">
          <button
            onClick={exportSubscriptions}
            className="ghost-button flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start px-4 py-2.5 text-sm font-medium"
            title="Export filtered subscriptions to CSV (E)"
          >
            <Download className="h-4 w-4" />
            <span className="hidden xs:inline">Export</span>
            <span className="xs:hidden">Export</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="ghost-button flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start px-4 py-2.5 text-sm font-medium"
            title="Create new subscription (N or C)"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden xs:inline">Create Subscription</span>
            <span className="xs:hidden">Create</span>
          </button>
          <button
            onClick={() => setShowKeyboardHelp(!showKeyboardHelp)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Keyboard shortcuts (Shift+?)"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex space-x-1 bg-gray-800/50 p-1 rounded-lg">
        <button
          onClick={() => setArchiveViewMode('subscriptions')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            archiveViewMode === 'subscriptions'
              ? 'bg-green-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          <Package className="w-4 h-4 inline mr-2" />
          Subscriptions
        </button>
        <button
          onClick={() => setArchiveViewMode('archive')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            archiveViewMode === 'archive'
              ? 'bg-green-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          <Archive className="w-4 h-4 inline mr-2" />
          Archive
        </button>
      </div>

      {archiveViewMode === 'subscriptions' && (
        <>
          {/* Filter Toolbar */}
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-4">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[300px]">
            <label className="block text-xs font-medium text-gray-400 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by service, client, or notes... (Press / to focus)"
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
                { value: 'dueToday', label: 'Due Today' },
                { value: 'dueIn3Days', label: 'Due in 3 Days' },
                { value: 'overdue', label: 'Overdue (All)' },
                { value: 'overdueNormal', label: 'Overdue (Normal)' },
                { value: 'overdueDeadPool', label: 'Overdue (Dead Pool)' }
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

          {/* Service Group Selector */}
          <div className="relative service-group-selector">
            <SearchableDropdown
              label="Service"
              options={[
                { value: '', label: 'All services' },
                ...serviceGroups.map(group => ({
                  value: group.baseName,
                  label: group.baseName
                }))
              ]}
              value={selectedServiceGroup}
              onChange={handleServiceGroupChange}
              placeholder="All services"
              searchPlaceholder="Search services..."
              className="min-w-[160px]"
              allowClear={true}
              onClear={() => {
                setSelectedServiceGroup('');
                setSelectedPeriod('');
              }}
              showSearchThreshold={3}
            />
          </div>

          {/* Period Selector - Only show when a service group is selected */}
          {selectedServiceGroup && (
            <div className="relative period-selector">
              <SearchableDropdown
                label="Period"
                options={[
                  { value: '', label: 'All periods' },
                  ...(() => {
                    const group = serviceGroups.find(g => g.baseName === selectedServiceGroup);
                    return group ? getAvailablePeriods(group) : [];
                  })()
                ]}
                value={selectedPeriod}
                onChange={handlePeriodChange}
                placeholder="All periods"
                searchPlaceholder="Search periods..."
                className="min-w-[120px]"
                allowClear={true}
                onClear={() => setSelectedPeriod('')}
                showSearchThreshold={3}
              />
            </div>
          )}

          {/* Reset Button */}
          <div className="flex items-end gap-2">
            <button
              onClick={resetFilters}
              className="px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Reset all filters"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            
            {/* Debug Refresh Button */}
            <button
              onClick={handleManualRefresh}
              className="px-3 py-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded-lg transition-colors"
              title="Force refresh from database"
            >
              🔄
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
          <div className="text-2xl font-bold text-red-400">{getTotalOverdue()}</div>
          <div className="text-sm text-gray-400">Overdue</div>
        </div>
      </div>

      {/* Keyboard Shortcuts Help Modal */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[110]">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Keyboard className="w-5 h-5" />
                Keyboard Shortcuts
              </h2>
              <button
                onClick={() => setShowKeyboardHelp(false)}
                className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-700/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Navigation</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                      <span className="text-gray-300 text-sm">Arrow Up/Down</span>
                      <kbd className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">↑ ↓</kbd>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                      <span className="text-gray-300 text-sm">Enter</span>
                      <kbd className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">Enter</kbd>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                      <span className="text-gray-300 text-sm">Focus Search</span>
                      <kbd className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">/</kbd>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Actions</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                      <span className="text-gray-300 text-sm">Create New</span>
                      <kbd className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">N</kbd>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                      <span className="text-gray-300 text-sm">Export</span>
                      <kbd className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">E</kbd>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                      <span className="text-gray-300 text-sm">Reset Filters</span>
                      <kbd className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">R</kbd>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                      <span className="text-gray-300 text-sm">Toggle Archive</span>
                      <kbd className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">A</kbd>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Quick Views</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                      <span className="text-gray-300 text-sm">View: All</span>
                      <kbd className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">1</kbd>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                      <span className="text-gray-300 text-sm">View: Active</span>
                      <kbd className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">2</kbd>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                      <span className="text-gray-300 text-sm">View: Completed</span>
                      <kbd className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">3</kbd>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                      <span className="text-gray-300 text-sm">View: Due Today</span>
                      <kbd className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">4</kbd>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                      <span className="text-gray-300 text-sm">View: Due in 3 Days</span>
                      <kbd className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">5</kbd>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                      <span className="text-gray-300 text-sm">View: Overdue</span>
                      <kbd className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">6</kbd>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">General</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                      <span className="text-gray-300 text-sm">Close Modal</span>
                      <kbd className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">Esc</kbd>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                      <span className="text-gray-300 text-sm">Show Help</span>
                      <kbd className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">Shift + ?</kbd>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-700">
                <p className="text-xs text-gray-400 text-center">
                  Keyboard shortcuts are disabled when typing in input fields
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subscriptions List - Mobile Viewport Optimized */}
      <div className="w-full max-w-full overflow-hidden">
        {filteredSubscriptions.length === 0 ? (
          <div className="text-center py-12 px-4">
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
                
                {/* Group Content - Mobile viewport optimized */}
                {!collapsedGroups.has(group.key) && (
                  <div className="w-full px-2 sm:px-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
                      {group.subscriptions.map((subscription, groupIndex) => {
                        const globalIndex = filteredSubscriptions.findIndex(sub => sub.id === subscription.id);
                        const isSelected = selectedCardIndex === globalIndex;
                        return (
                          <div 
                            key={subscription.id} 
                            ref={(el) => {
                              if (globalIndex >= 0 && globalIndex < cardRefs.current.length) {
                                cardRefs.current[globalIndex] = el;
                              }
                            }}
                            className={`w-full min-w-0 transition-all ${
                              isSelected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-900 rounded-2xl' : ''
                            }`}
                          >
                            <SubscriptionCard
                              subscription={subscription}
                              onUpdate={handleSubscriptionUpdate}
                              onDelete={handleSubscriptionDelete}
                              onView={handleSubscriptionView}
                              onEdit={handleSubscriptionEdit}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          // Ungrouped view - Mobile viewport optimized
          <div className="w-full px-2 sm:px-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
              {filteredSubscriptions.map((subscription, index) => {
                const isSelected = selectedCardIndex === index;
                return (
                  <div 
                    key={subscription.id} 
                    ref={(el) => {
                      if (index < cardRefs.current.length) {
                        cardRefs.current[index] = el;
                      }
                    }}
                    className={`w-full min-w-0 transition-all ${
                      isSelected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-900 rounded-2xl' : ''
                    }`}
                  >
                    <SubscriptionCard
                      subscription={subscription}
                      onUpdate={handleSubscriptionUpdate}
                      onDelete={handleSubscriptionDelete}
                      onView={handleSubscriptionView}
                      onEdit={handleSubscriptionEdit}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
        </>
      )}

      {archiveViewMode === 'archive' && (
        <>
          {/* Archive Filter Toolbar */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-4">
            <div className="flex flex-wrap gap-4 items-center">
              {/* Search Input */}
              <div className="relative flex-1 min-w-[300px]">
                <label className="block text-xs font-medium text-gray-400 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search archived subscriptions... (Press / to focus)"
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

              {/* Service Group Selector */}
              <div className="relative service-group-selector">
                <SearchableDropdown
                  label="Service"
                  options={[
                    { value: '', label: 'All services' },
                    ...serviceGroups.map(group => ({
                      value: group.baseName,
                      label: group.baseName
                    }))
                  ]}
                  value={selectedServiceGroup}
                  onChange={handleServiceGroupChange}
                  placeholder="All services"
                  searchPlaceholder="Search services..."
                  className="min-w-[160px]"
                  allowClear={true}
                  onClear={() => {
                    setSelectedServiceGroup('');
                    setSelectedPeriod('');
                  }}
                  showSearchThreshold={3}
                />
              </div>

              {/* Period Selector - Only show when a service group is selected */}
              {selectedServiceGroup && (
                <div className="relative period-selector">
                  <SearchableDropdown
                    label="Period"
                    options={[
                      { value: '', label: 'All periods' },
                      ...(() => {
                        const group = serviceGroups.find(g => g.baseName === selectedServiceGroup);
                        return group ? getAvailablePeriods(group) : [];
                      })()
                    ]}
                    value={selectedPeriod}
                    onChange={handlePeriodChange}
                    placeholder="All periods"
                    searchPlaceholder="Search periods..."
                    className="min-w-[120px]"
                    allowClear={true}
                    onClear={() => setSelectedPeriod('')}
                    showSearchThreshold={3}
                  />
                </div>
              )}

              {/* Reset Button */}
              <div className="flex items-end gap-2">
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

          {/* Archive Stats */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold text-gray-400">{getTotalArchived()}</div>
            <div className="text-sm text-gray-400">Archived Subscriptions</div>
          </div>

          {/* Archived Subscriptions List */}
          <div className="w-full max-w-full overflow-hidden">
            {filteredArchivedSubscriptions.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Archive className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No archived subscriptions</h3>
                <p className="text-gray-400 mb-4">
                  Archived subscriptions will appear here.
                </p>
              </div>
            ) : (
              <div className="w-full px-2 sm:px-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
                  {filteredArchivedSubscriptions.map((subscription, index) => {
                    const isSelected = selectedCardIndex === index;
                    return (
                      <div 
                        key={subscription.id} 
                        ref={(el) => {
                          if (index < cardRefs.current.length) {
                            cardRefs.current[index] = el;
                          }
                        }}
                        className={`w-full min-w-0 transition-all ${
                          isSelected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-900 rounded-2xl' : ''
                        }`}
                      >
                        <SubscriptionCard
                          subscription={subscription}
                          onUpdate={handleSubscriptionUpdate}
                          onDelete={handleSubscriptionDelete}
                          onView={handleSubscriptionView}
                          onEdit={handleSubscriptionEdit}
                          isArchived={true}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}

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
        onEdit={handleSubscriptionEdit}
      />

      {/* Unified Subscription Edit Modal */}
      <SubscriptionEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingSubscription(null);
          // Also close the detail modal when edit modal closes
          setIsDetailModalOpen(false);
          setSelectedSubscription(null);
        }}
        subscription={editingSubscription}
        onUpdate={handleSubscriptionUpdate}
        onDelete={handleSubscriptionDelete}
      />

    </div>
   );
 }
