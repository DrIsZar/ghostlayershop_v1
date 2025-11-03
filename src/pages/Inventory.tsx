import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Package, 
  Users, 
  Clock, 
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  X,
  RotateCcw,
  Archive
} from 'lucide-react';
import { ResourcePool, PoolFilter } from '../types/inventory';
import { listResourcePools, refreshPoolStatus, archiveResourcePool, updateResourcePool, deleteResourcePool, searchPoolsBySeatEmail } from '../lib/inventory';
import { PoolCard } from '../components/PoolCard';
import { PoolFormModal } from '../components/PoolFormModal';
import { PoolDetailModal } from '../components/PoolDetailModal';
import PoolEditModal from '../components/PoolEditModal';
import SearchableDropdown from '../components/SearchableDropdown';
import { SERVICE_PROVISIONING, PROVIDER_ICONS, POOL_TYPE_LABELS, STATUS_LABELS } from '../constants/provisioning';

type ViewMode = 'pools' | 'archive';

export default function Inventory() {
  const [viewMode, setViewMode] = useState<ViewMode>('pools');
  const [pools, setPools] = useState<ResourcePool[]>([]);
  const [filteredPools, setFilteredPools] = useState<ResourcePool[]>([]);
  const [archivedPools, setArchivedPools] = useState<ResourcePool[]>([]);
  const [filteredArchivedPools, setFilteredArchivedPools] = useState<ResourcePool[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPool, setSelectedPool] = useState<ResourcePool | null>(null);
  
  // Filter state
  const [filters, setFilters] = useState<PoolFilter>({});
  const [archiveFilters, setArchiveFilters] = useState<PoolFilter>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [matchingPoolIdsBySeat, setMatchingPoolIdsBySeat] = useState<Set<string>>(new Set());
  

  useEffect(() => {
    const initializeData = async () => {
      // First refresh pool status to auto-archive expired pools
      await refreshPoolStatus();
      // Then fetch the updated data
      await fetchPools();
      await fetchArchivedPools();
    };
    
    initializeData();
    
    // Set up periodic refresh every 5 minutes to auto-archive expired pools
    const interval = setInterval(async () => {
      await refreshPoolStatus();
      await fetchPools();
      await fetchArchivedPools();
    }, 5 * 60 * 1000); // 5 minutes
    
    return () => clearInterval(interval);
  }, []);

  // Refresh pools when component becomes visible again (user returns to page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Page became visible, refreshing pools...');
        fetchPools();
        fetchArchivedPools();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch matching pool IDs by seat email when search term changes
  useEffect(() => {
    const fetchMatchingPoolIds = async () => {
      if (debouncedSearchTerm.trim()) {
        const { data: poolIds, error } = await searchPoolsBySeatEmail(debouncedSearchTerm);
        if (!error && poolIds) {
          setMatchingPoolIdsBySeat(new Set(poolIds));
        } else {
          setMatchingPoolIdsBySeat(new Set());
        }
      } else {
        setMatchingPoolIdsBySeat(new Set());
      }
    };
    
    fetchMatchingPoolIds();
  }, [debouncedSearchTerm]);

  useEffect(() => {
    applyFilters();
  }, [pools, filters, debouncedSearchTerm, matchingPoolIdsBySeat]);

  useEffect(() => {
    applyArchiveFilters();
  }, [archivedPools, archiveFilters, debouncedSearchTerm, matchingPoolIdsBySeat]);

  const fetchPools = async () => {
    try {
      setLoading(true);
      const { data, error } = await listResourcePools();
      if (error) throw error;
      // Filter out archived pools from main pools list (expired pools that are not alive are considered archived)
      const activePools = (data || []).filter(pool => !(pool.status === 'expired' && !pool.is_alive));
      setPools(activePools);
    } catch (error) {
      console.error('Error fetching pools:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchArchivedPools = async () => {
    try {
      const { data, error } = await listResourcePools();
      if (error) throw error;
      // Filter to only show archived pools (expired and not alive)
      const archived = (data || []).filter(pool => pool.status === 'expired' && !pool.is_alive);
      setArchivedPools(archived);
    } catch (error) {
      console.error('Error fetching archived pools:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...pools];

    // Apply search filter
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(pool => {
        const providerMatch = pool.provider.toLowerCase().includes(searchLower);
        const emailMatch = pool.login_email.toLowerCase().includes(searchLower);
        const notesMatch = pool.notes?.toLowerCase().includes(searchLower) || false;
        // Also check if this pool has a seat with matching assigned_email
        const seatEmailMatch = matchingPoolIdsBySeat.has(pool.id);
        return providerMatch || emailMatch || notesMatch || seatEmailMatch;
      });
    }

    // Apply other filters
    if (filters.provider) {
      filtered = filtered.filter(pool => pool.provider === filters.provider);
    }
    if (filters.status) {
      filtered = filtered.filter(pool => pool.status === filters.status);
    }
    if (filters.pool_type) {
      filtered = filtered.filter(pool => pool.pool_type === filters.pool_type);
    }
    if (typeof filters.alive === 'boolean') {
      filtered = filtered.filter(pool => pool.is_alive === filters.alive);
    }


    // Apply available seats filter
    if (filters.has_available_seats) {
      filtered = filtered.filter(pool => pool.used_seats < pool.max_seats);
    }


    // Sort pools
    filtered.sort((a, b) => {
      // Sort by status priority, then by end date
      const statusPriority = { active: 0, paused: 1, completed: 2, expired: 3 };
      const statusDiff = statusPriority[a.status] - statusPriority[b.status];
      if (statusDiff !== 0) return statusDiff;
      
      return new Date(a.end_at).getTime() - new Date(b.end_at).getTime();
    });

    setFilteredPools(filtered);
  };

  const applyArchiveFilters = () => {
    let filtered = [...archivedPools];

    // Apply search filter
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(pool => {
        const providerMatch = pool.provider.toLowerCase().includes(searchLower);
        const emailMatch = pool.login_email.toLowerCase().includes(searchLower);
        const notesMatch = pool.notes?.toLowerCase().includes(searchLower) || false;
        // Also check if this pool has a seat with matching assigned_email
        const seatEmailMatch = matchingPoolIdsBySeat.has(pool.id);
        return providerMatch || emailMatch || notesMatch || seatEmailMatch;
      });
    }

    // Apply other filters
    if (archiveFilters.provider) {
      filtered = filtered.filter(pool => pool.provider === archiveFilters.provider);
    }
    if (archiveFilters.pool_type) {
      filtered = filtered.filter(pool => pool.pool_type === archiveFilters.pool_type);
    }

    // Sort archived pools by archive date (most recent first)
    filtered.sort((a, b) => {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    setFilteredArchivedPools(filtered);
  };

  const resetFilters = () => {
    setFilters({});
    setSearchTerm('');
  };

  const resetArchiveFilters = () => {
    setArchiveFilters({});
  };

  const handlePoolCreated = (pool: ResourcePool) => {
    setPools(prev => [pool, ...prev]);
  };

  const handlePoolView = (pool: ResourcePool) => {
    setSelectedPool(pool);
    setIsDetailModalOpen(true);
  };

  const handlePoolEdit = (pool: ResourcePool) => {
    setSelectedPool(pool);
    setIsEditModalOpen(true);
  };

  const handlePoolDelete = async (poolId: string) => {
    try {
      const { error } = await deleteResourcePool(poolId);
      if (error) throw error;
      
      // Remove from both active and archived pools
      setPools(prev => prev.filter(pool => pool.id !== poolId));
      setArchivedPools(prev => prev.filter(pool => pool.id !== poolId));
      
      console.log('Pool deleted successfully');
    } catch (error) {
      console.error('Error deleting pool:', error);
    }
  };

  const handlePoolUpdate = (updatedPool: ResourcePool) => {
    setPools(prev => prev.map(pool => 
      pool.id === updatedPool.id ? updatedPool : pool
    ));
    // If the detail modal is open for this pool, keep it in sync
    setSelectedPool(prev => (prev && prev.id === updatedPool.id ? updatedPool : prev));
  };

  const handlePoolArchive = async (poolId: string) => {
    try {
      const { data, error } = await archiveResourcePool(poolId);
      if (error) throw error;
      
      // Refresh both pools and archived pools to ensure consistency
      await fetchPools();
      await fetchArchivedPools();
      
      console.log('Pool archived successfully');
    } catch (error) {
      console.error('Error archiving pool:', error);
    }
  };

  const handlePoolRestore = async (poolId: string) => {
    try {
      // Restore pool by setting it back to active and alive
      const { data, error } = await updateResourcePool(poolId, {
        status: 'active',
        is_alive: true
      });
      if (error) throw error;
      
      // Refresh both pools and archived pools to ensure consistency
      await fetchPools();
      await fetchArchivedPools();
      
      console.log('Pool restored successfully');
    } catch (error) {
      console.error('Error restoring pool:', error);
    }
  };



  const getStats = () => {
    const total = pools.length;
    const active = pools.filter(p => p.status === 'active').length;
    const expired = pools.filter(p => p.status === 'expired').length;
    const totalSeats = pools.reduce((sum, p) => sum + p.max_seats, 0);
    const usedSeats = pools.reduce((sum, p) => sum + p.used_seats, 0);
    
    // Archive stats
    const totalArchived = archivedPools.length;
    const recentlyArchived = archivedPools.filter(p => {
      const archiveDate = new Date(p.updated_at);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return archiveDate >= weekAgo;
    }).length;
    
    return { 
      total, 
      active, 
      expired, 
      totalSeats, 
      usedSeats, 
      totalArchived, 
      recentlyArchived 
    };
  };

  const stats = getStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Inventory</h1>
          <p className="text-gray-400 mt-1 text-sm sm:text-base">
            Manage resource pools and seat assignments
          </p>
        </div>
        <div className="flex-shrink-0">
          <button
            onClick={() => setIsModalOpen(true)}
            className="ghost-button flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start px-4 py-2.5 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden xs:inline">New Pool</span>
            <span className="xs:hidden">New</span>
          </button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex space-x-1 bg-gray-800/50 p-1 rounded-lg">
        <button
          onClick={() => setViewMode('pools')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            viewMode === 'pools'
              ? 'bg-green-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          <Package className="w-4 h-4 inline mr-2" />
          Pools
        </button>
        <button
          onClick={() => setViewMode('archive')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            viewMode === 'archive'
              ? 'bg-green-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          <Archive className="w-4 h-4 inline mr-2" />
          Archive
        </button>
      </div>

      {viewMode === 'pools' && (
        <>
          {/* Filter Toolbar */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-4">
            <div className="flex flex-wrap gap-4 items-center">
              {/* Search Input */}
              <div className="relative flex-1 min-w-[300px]">
                <label className="block text-xs font-medium text-gray-400 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-1.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
                  <input
                    type="text"
                    placeholder="Search by provider, email, notes, or seat email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-green-500"
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

              {/* Provider Filter */}
              <div className="relative">
                <SearchableDropdown
                  label="Provider"
                  options={[
                    { value: '', label: 'All providers' },
                    ...Object.keys(SERVICE_PROVISIONING).map(provider => ({
                      value: provider,
                      label: `${PROVIDER_ICONS[provider] || '📦'} ${provider.charAt(0).toUpperCase() + provider.slice(1)}`
                    }))
                  ]}
                  value={filters.provider || ''}
                  onChange={(value) => setFilters(prev => ({ ...prev, provider: value || undefined }))}
                  placeholder="All providers"
                  className="min-w-[160px]"
                  allowClear={true}
                  onClear={() => setFilters(prev => ({ ...prev, provider: undefined }))}
                  showSearchThreshold={3}
                />
              </div>

              {/* Status Filter */}
              <div className="relative">
                <SearchableDropdown
                  label="Status"
                  options={[
                    { value: '', label: 'All statuses' },
                    ...Object.entries(STATUS_LABELS).map(([key, label]) => ({
                      value: key,
                      label
                    }))
                  ]}
                  value={filters.status || ''}
                  onChange={(value) => setFilters(prev => ({ ...prev, status: value as any || undefined }))}
                  placeholder="All statuses"
                  className="min-w-[140px]"
                  allowClear={true}
                  onClear={() => setFilters(prev => ({ ...prev, status: undefined }))}
                  showSearchThreshold={3}
                />
              </div>

              {/* Pool Type Filter */}
              <div className="relative">
                <SearchableDropdown
                  label="Type"
                  options={[
                    { value: '', label: 'All types' },
                    ...Object.entries(POOL_TYPE_LABELS).map(([key, label]) => ({
                      value: key,
                      label
                    }))
                  ]}
                  value={filters.pool_type || ''}
                  onChange={(value) => setFilters(prev => ({ ...prev, pool_type: value as any || undefined }))}
                  placeholder="All types"
                  className="min-w-[140px]"
                  allowClear={true}
                  onClear={() => setFilters(prev => ({ ...prev, pool_type: undefined }))}
                  showSearchThreshold={3}
                />
              </div>

              {/* Available Seats Filter */}
              <div className="relative">
                <SearchableDropdown
                  label="Seats"
                  options={[
                    { value: '', label: 'All pools' },
                    { value: 'available', label: 'Has Available Seats' },
                    { value: 'full', label: 'Fully Utilized' }
                  ]}
                  value={filters.has_available_seats ? 'available' : filters.utilization_rate === 'full' ? 'full' : ''}
                  onChange={(value) => {
                    if (value === 'available') {
                      setFilters(prev => ({ ...prev, has_available_seats: true, utilization_rate: undefined }));
                    } else if (value === 'full') {
                      setFilters(prev => ({ ...prev, has_available_seats: undefined, utilization_rate: 'full' }));
                    } else {
                      setFilters(prev => ({ ...prev, has_available_seats: undefined, utilization_rate: undefined }));
                    }
                  }}
                  placeholder="All pools"
                  className="min-w-[160px]"
                  allowClear={true}
                  onClear={() => setFilters(prev => ({ ...prev, has_available_seats: undefined, utilization_rate: undefined }))}
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

          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                  <Package className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Total Pools</p>
                  <p className="text-2xl font-bold text-white">{stats.total}</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Active</p>
                  <p className="text-2xl font-bold text-white">{stats.active}</p>
                </div>
              </div>
            </div>


            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Seats Used</p>
                  <p className="text-2xl font-bold text-white">{stats.usedSeats}/{stats.totalSeats}</p>
                </div>
              </div>
            </div>
          </div>


          {/* Pools List */}
          <div className="space-y-4">
            {filteredPools.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No pools match your filters</h3>
                <p className="text-gray-400 mb-4">
                  Try resetting filters or creating a new pool.
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
                    Create Pool
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {filteredPools.map(pool => (
                  <PoolCard
                    key={pool.id}
                    pool={pool}
                    onUpdate={handlePoolUpdate}
                    onArchive={handlePoolArchive}
                    onView={handlePoolView}
                    onEdit={handlePoolEdit}
                    onDelete={handlePoolDelete}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {viewMode === 'archive' && (
        <>
          {/* Archive Filter Toolbar */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-4">
            <div className="flex flex-wrap gap-4 items-center">
              {/* Search Input */}
              <div className="relative flex-1 min-w-[300px]">
                <label className="block text-xs font-medium text-gray-400 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-1.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
                  <input
                    type="text"
                    placeholder="Search by provider, email, notes, or seat email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-green-500"
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

              {/* Provider Filter */}
              <div className="relative">
                <SearchableDropdown
                  label="Provider"
                  options={[
                    { value: '', label: 'All providers' },
                    ...Object.keys(SERVICE_PROVISIONING).map(provider => ({
                      value: provider,
                      label: `${PROVIDER_ICONS[provider] || '📦'} ${provider.charAt(0).toUpperCase() + provider.slice(1)}`
                    }))
                  ]}
                  value={archiveFilters.provider || ''}
                  onChange={(value) => setArchiveFilters(prev => ({ ...prev, provider: value || undefined }))}
                  placeholder="All providers"
                  className="min-w-[160px]"
                  allowClear={true}
                  onClear={() => setArchiveFilters(prev => ({ ...prev, provider: undefined }))}
                  showSearchThreshold={3}
                />
              </div>

              {/* Pool Type Filter */}
              <div className="relative">
                <SearchableDropdown
                  label="Type"
                  options={[
                    { value: '', label: 'All types' },
                    ...Object.entries(POOL_TYPE_LABELS).map(([key, label]) => ({
                      value: key,
                      label
                    }))
                  ]}
                  value={archiveFilters.pool_type || ''}
                  onChange={(value) => setArchiveFilters(prev => ({ ...prev, pool_type: value as any || undefined }))}
                  placeholder="All types"
                  className="min-w-[140px]"
                  allowClear={true}
                  onClear={() => setArchiveFilters(prev => ({ ...prev, pool_type: undefined }))}
                  showSearchThreshold={3}
                />
              </div>

              {/* Reset Button */}
              <div className="flex items-end">
                <button
                  onClick={resetArchiveFilters}
                  className="px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Reset all filters"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Archive Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                  <Archive className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Total Archived</p>
                  <p className="text-2xl font-bold text-white">{stats.totalArchived}</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Recent (7 days)</p>
                  <p className="text-2xl font-bold text-white">{stats.recentlyArchived}</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                  <Package className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Active Pools</p>
                  <p className="text-2xl font-bold text-white">{stats.active}</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Total Seats</p>
                  <p className="text-2xl font-bold text-white">{stats.totalSeats}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Archived Pools List */}
          <div className="space-y-4">
            {filteredArchivedPools.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Archive className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No archived pools found</h3>
                <p className="text-gray-400 mb-4">
                  {archivedPools.length === 0 
                    ? "No pools have been archived yet." 
                    : "No archived pools match your current filters."
                  }
                </p>
                {archivedPools.length > 0 && (
                  <button
                    onClick={resetArchiveFilters}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors duration-200"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {filteredArchivedPools.map(pool => (
                  <PoolCard
                    key={pool.id}
                    pool={pool}
                    onUpdate={handlePoolUpdate}
                    onArchive={handlePoolRestore}
                    onView={handlePoolView}
                    onEdit={handlePoolEdit}
                    onDelete={handlePoolDelete}
                    isArchived={true}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      <PoolFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onPoolCreated={handlePoolCreated}
      />

      <PoolDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedPool(null);
        }}
        pool={selectedPool}
        onUpdate={handlePoolUpdate}
        onDelete={handlePoolArchive}
      />

      <PoolEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedPool(null);
        }}
        pool={selectedPool}
        onPoolUpdated={(updatedPool) => {
          handlePoolUpdate(updatedPool);
          setIsEditModalOpen(false);
          setSelectedPool(null);
        }}
      />
    </div>
  );
}
