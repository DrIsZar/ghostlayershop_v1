import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
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
import { listResourcePools, refreshPoolStatus } from '../lib/inventory';
import { PoolCard } from '../components/PoolCard';
import { PoolFormModal } from '../components/PoolFormModal';
import { PoolDetailModal } from '../components/PoolDetailModal';
import SearchableDropdown from '../components/SearchableDropdown';
import { SERVICE_PROVISIONING, PROVIDER_ICONS, POOL_TYPE_LABELS, STATUS_LABELS } from '../constants/provisioning';

type ViewMode = 'pools' | 'assignments';
type TimeBucket = 'today' | '3days' | 'overdue' | 'expired';

export default function Inventory() {
  const [viewMode, setViewMode] = useState<ViewMode>('pools');
  const [pools, setPools] = useState<ResourcePool[]>([]);
  const [filteredPools, setFilteredPools] = useState<ResourcePool[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedPool, setSelectedPool] = useState<ResourcePool | null>(null);
  
  // Filter state
  const [filters, setFilters] = useState<PoolFilter>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  // UI state
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchPools();
    refreshPoolStatus(); // Refresh status on load
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    applyFilters();
  }, [pools, filters, debouncedSearchTerm]);

  const fetchPools = async () => {
    try {
      setLoading(true);
      const { data, error } = await listResourcePools();
      if (error) throw error;
      setPools(data || []);
    } catch (error) {
      console.error('Error fetching pools:', error);
    } finally {
      setLoading(false);
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
        return providerMatch || emailMatch || notesMatch;
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

    // Apply time bucket filter
    if (filters.time_bucket) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
      
      filtered = filtered.filter(pool => {
        const endDate = new Date(pool.end_at);
        switch (filters.time_bucket) {
          case 'today':
            return endDate >= today && endDate < new Date(today.getTime() + 24 * 60 * 60 * 1000);
          case '3days':
            return endDate >= today && endDate < threeDaysFromNow;
          case 'overdue':
            return endDate < today && ['active', 'overdue'].includes(pool.status);
          case 'expired':
            return pool.status === 'expired';
          default:
            return true;
        }
      });
    }

    // Sort pools
    filtered.sort((a, b) => {
      // Sort by status priority, then by end date
      const statusPriority = { active: 0, overdue: 1, paused: 2, completed: 3, expired: 4 };
      const statusDiff = statusPriority[a.status] - statusPriority[b.status];
      if (statusDiff !== 0) return statusDiff;
      
      return new Date(a.end_at).getTime() - new Date(b.end_at).getTime();
    });

    setFilteredPools(filtered);
  };

  const resetFilters = () => {
    setFilters({});
    setSearchTerm('');
  };

  const toggleSection = (sectionKey: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(sectionKey)) {
      newCollapsed.delete(sectionKey);
    } else {
      newCollapsed.add(sectionKey);
    }
    setCollapsedSections(newCollapsed);
  };

  const handlePoolCreated = (pool: ResourcePool) => {
    setPools(prev => [pool, ...prev]);
  };

  const handlePoolView = (pool: ResourcePool) => {
    setSelectedPool(pool);
    setIsDetailModalOpen(true);
  };

  const handlePoolUpdate = (updatedPool: ResourcePool) => {
    setPools(prev => prev.map(pool => 
      pool.id === updatedPool.id ? updatedPool : pool
    ));
  };

  const handlePoolDelete = (poolId: string) => {
    setPools(prev => prev.filter(pool => pool.id !== poolId));
  };

  const getStats = () => {
    const total = pools.length;
    const active = pools.filter(p => p.status === 'active').length;
    const overdue = pools.filter(p => p.status === 'overdue').length;
    const expired = pools.filter(p => p.status === 'expired').length;
    const totalSeats = pools.reduce((sum, p) => sum + p.max_seats, 0);
    const usedSeats = pools.reduce((sum, p) => sum + p.used_seats, 0);
    
    return { total, active, overdue, expired, totalSeats, usedSeats };
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Inventory</h1>
          <p className="text-gray-400 mt-1">
            Manage resource pools and seat assignments
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="ghost-button flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Pool
        </button>
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
          onClick={() => setViewMode('assignments')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            viewMode === 'assignments'
              ? 'bg-green-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          <Users className="w-4 h-4 inline mr-2" />
          Assignments
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
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search by provider, email, or notes..."
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
                />
              </div>

              {/* Time Bucket Filter */}
              <div className="relative">
                <SearchableDropdown
                  label="Time"
                  options={[
                    { value: '', label: 'All time' },
                    { value: 'today', label: 'Due Today' },
                    { value: '3days', label: 'Due in 3 Days' },
                    { value: 'overdue', label: 'Overdue' },
                    { value: 'expired', label: 'Expired' }
                  ]}
                  value={filters.time_bucket || ''}
                  onChange={(value) => setFilters(prev => ({ ...prev, time_bucket: value as any || undefined }))}
                  placeholder="All time"
                  className="min-w-[140px]"
                  allowClear={true}
                  onClear={() => setFilters(prev => ({ ...prev, time_bucket: undefined }))}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Overdue</p>
                  <p className="text-2xl font-bold text-white">{stats.overdue}</p>
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
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredPools.map(pool => (
                  <PoolCard
                    key={pool.id}
                    pool={pool}
                    onUpdate={handlePoolUpdate}
                    onDelete={handlePoolDelete}
                    onView={handlePoolView}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {viewMode === 'assignments' && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">Assignments View</h3>
          <p className="text-gray-400">
            This view will show all seat assignments across pools.
          </p>
        </div>
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
        onDelete={handlePoolDelete}
      />
    </div>
  );
}
