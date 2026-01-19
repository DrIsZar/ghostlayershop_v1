import React, { useState, useEffect } from 'react';
import {
  MoreVertical,
  Eye,
  Edit,
  Archive,
  Copy,
  Pause,
  Play,
  Heart,
  HeartOff,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Trash2,
  RotateCcw
} from 'lucide-react';
import { ResourcePool } from '../types/inventory';
import { PROVIDER_ICONS, STATUS_COLORS, POOL_TYPE_LABELS } from '../constants/provisioning';
import { copyToClipboard } from '../lib/toast';
import { updateResourcePool } from '../lib/inventory';
import { getProviderLogo } from '../lib/fileUtils';
import { Image } from 'lucide-react';

interface PoolCardProps {
  pool: ResourcePool;
  onUpdate: (pool: ResourcePool) => void;
  onArchive: (poolId: string) => void;
  onView: (pool: ResourcePool) => void;
  onEdit: (pool: ResourcePool) => void;
  onDelete: (poolId: string) => void;
  isArchived?: boolean;
}

export function PoolCard({ pool, onUpdate, onArchive, onView, onEdit, onDelete, isArchived = false }: PoolCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [providerLogo, setProviderLogo] = useState<string | null>(null);

  useEffect(() => {
    // Try to get logo synchronously first
    const logo = getProviderLogo(pool.provider);
    setProviderLogo(logo);

    // If not found, try async lookup
    if (!logo) {
      getProviderLogoAsync(pool.provider).then(setProviderLogo).catch(() => { });
    }

    // Listen for logo updates
    const handleLogoUpdate = () => {
      const newLogo = getProviderLogo(pool.provider);
      if (newLogo) setProviderLogo(newLogo);
    };

    window.addEventListener('logoUpdated', handleLogoUpdate);
    window.addEventListener('storage', handleLogoUpdate);

    return () => {
      window.removeEventListener('logoUpdated', handleLogoUpdate);
      window.removeEventListener('storage', handleLogoUpdate);
    };
  }, [pool.provider]);

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'bg-white/10 text-white border-white/50',
      paused: 'bg-slate-900/30 text-slate-400 border-slate-700/50',
      completed: 'bg-zinc-800/50 text-white border-white/50',
      overdue: 'bg-amber-900/30 text-amber-400 border-amber-700/50',
      expired: 'bg-red-900/30 text-red-400 border-red-700/50',
    };
    return colors[status as keyof typeof colors] || colors.active;
  };

  const getTimeUntilExpiry = () => {
    const now = new Date();
    const endDate = new Date(pool.end_at);
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Expired';
    if (diffDays === 0) return 'Expires today';
    if (diffDays === 1) return 'Expires tomorrow';
    if (diffDays <= 7) return `Expires in ${diffDays} days`;
    if (diffDays <= 30) return `Expires in ${Math.ceil(diffDays / 7)} weeks`;
    return `Expires in ${Math.ceil(diffDays / 30)} months`;
  };

  const getTimeColor = () => {
    const now = new Date();
    const endDate = new Date(pool.end_at);
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'text-red-400';
    if (diffDays <= 1) return 'text-red-400';
    if (diffDays <= 3) return 'text-amber-400';
    return 'text-gray-400';
  };

  const getSeatUsageColor = () => {
    const usage = pool.used_seats / pool.max_seats;
    if (usage >= 0.9) return 'bg-red-500';
    if (usage >= 0.7) return 'bg-amber-500';
    return 'bg-white';
  };

  const handleCopy = async (text: string, type: 'login' | 'password') => {
    const message = type === 'login' ? 'Login copied to clipboard' : 'Password copied to clipboard';
    await copyToClipboard(text, message);
  };

  const handleToggleAlive = async () => {
    const newAliveStatus = !pool.is_alive;
    try {
      console.log(`Toggling pool ${pool.id} is_alive from ${pool.is_alive} to ${newAliveStatus}`);
      const { data, error } = await updateResourcePool(pool.id, { is_alive: newAliveStatus });
      if (error) {
        console.error('Error updating pool:', error);
        alert(`Failed to update pool: ${error.message || 'Unknown error'}`);
        return;
      }
      if (!data) {
        alert('Failed to update pool: No data returned');
        return;
      }
      console.log('Pool updated successfully, received data:', data);
      // Verify the update was saved
      if (data.is_alive !== newAliveStatus) {
        console.error('Update verification failed: is_alive mismatch', {
          expected: newAliveStatus,
          actual: data.is_alive
        });
        alert('Warning: Pool update may not have been saved correctly. Please refresh the page.');
      }
      // Update parent state with fresh data from database
      onUpdate(data);
    } catch (error) {
      console.error('Error updating pool:', error);
      alert(`Failed to update pool: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleToggleStatus = async () => {
    const newStatus = pool.status === 'paused' ? 'active' : 'paused';
    try {
      const { data, error } = await updateResourcePool(pool.id, { status: newStatus });
      if (error) {
        console.error('Error updating pool status:', error);
        alert(`Failed to update pool status: ${error.message || 'Unknown error'}`);
        return;
      }
      if (!data) {
        alert('Failed to update pool status: No data returned');
        return;
      }
      onUpdate(data);
    } catch (error) {
      console.error('Error updating pool status:', error);
      alert(`Failed to update pool status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Check if pool is expiring soon (within 3 days)
  const isExpiringSoon = () => {
    const now = new Date();
    const endDate = new Date(pool.end_at);
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 3;
  };

  return (
    <div className="w-full max-w-full rounded-2xl border border-gray-700/50 bg-gray-800/50 hover:bg-gray-800/70 transition-all duration-200 group hover-lift-subtle">
      {/* Header - Mobile Viewport Optimized */}
      <div className="p-3 sm:p-4 border-b border-gray-700/30">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
              {providerLogo ? (
                <img
                  src={providerLogo}
                  alt={`${pool.provider} logo`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.classList.remove('hidden');
                    setProviderLogo(null);
                  }}
                />
              ) : null}
              <div className={`w-full h-full flex items-center justify-center text-sm sm:text-lg lg:text-xl ${providerLogo ? 'hidden' : ''}`}>
                {PROVIDER_ICONS[pool.provider] || '📦'}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-white capitalize truncate">
                {pool.provider.replace('_', ' ')}
              </h3>
              <p className="text-xs sm:text-sm text-gray-400 truncate">
                {POOL_TYPE_LABELS[pool.pool_type] || pool.pool_type}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* Status Badge */}
            <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium border transition-all ${getStatusColor(pool.status)}`}>
              {pool.status}
            </span>

            {/* Alive Indicator with pulse for expiring pools */}
            <div className={`w-2 h-2 rounded-full transition-all ${pool.is_alive ? 'bg-white' : 'bg-red-500'} ${pool.is_alive && isExpiringSoon() ? 'animate-pulse' : ''}`} />

            {/* Menu */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors min-h-[36px] min-w-[36px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center"
                aria-label="More options"
              >
                <MoreVertical className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>

              {showMenu && (
                <div className="absolute right-0 top-6 sm:top-8 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 min-w-[140px] sm:min-w-[160px]">
                  <button
                    onClick={() => {
                      onView(pool);
                      setShowMenu(false);
                    }}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-left text-xs sm:text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-1.5 sm:gap-2"
                  >
                    <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden xs:inline">View Details</span>
                    <span className="xs:hidden">View</span>
                  </button>
                  <button
                    onClick={() => {
                      onEdit(pool);
                      setShowMenu(false);
                    }}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-left text-xs sm:text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-1.5 sm:gap-2"
                  >
                    <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      handleCopy(pool.login_email, 'login');
                      setShowMenu(false);
                    }}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-left text-xs sm:text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-1.5 sm:gap-2"
                  >
                    <Copy className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden xs:inline">Copy Email</span>
                    <span className="xs:hidden">Copy</span>
                  </button>
                  <button
                    onClick={() => {
                      handleToggleStatus();
                      setShowMenu(false);
                    }}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-left text-xs sm:text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-1.5 sm:gap-2"
                  >
                    {pool.status === 'paused' ? <Play className="w-3 h-3 sm:w-4 sm:h-4" /> : <Pause className="w-3 h-3 sm:w-4 sm:h-4" />}
                    <span className="hidden xs:inline">{pool.status === 'paused' ? 'Resume' : 'Pause'}</span>
                    <span className="xs:hidden">{pool.status === 'paused' ? 'Resume' : 'Pause'}</span>
                  </button>
                  <button
                    onClick={() => {
                      handleToggleAlive();
                      setShowMenu(false);
                    }}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-left text-xs sm:text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-1.5 sm:gap-2"
                  >
                    {pool.is_alive ? <HeartOff className="w-3 h-3 sm:w-4 sm:h-4" /> : <Heart className="w-3 h-3 sm:w-4 sm:h-4" />}
                    <span className="hidden xs:inline">{pool.is_alive ? 'Mark Dead' : 'Mark Alive'}</span>
                    <span className="xs:hidden">{pool.is_alive ? 'Dead' : 'Alive'}</span>
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(isArchived ? 'Are you sure you want to restore this pool?' : 'Are you sure you want to archive this pool?')) {
                        onArchive(pool.id);
                      }
                      setShowMenu(false);
                    }}
                    className={`w-full px-2 sm:px-3 py-1.5 sm:py-2 text-left text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 ${isArchived
                        ? 'text-white hover:bg-white/10'
                        : 'text-amber-400 hover:bg-amber-900/20'
                      }`}
                  >
                    {isArchived ? <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4" /> : <Archive className="w-3 h-3 sm:w-4 sm:h-4" />}
                    {isArchived ? 'Restore' : 'Archive'}
                  </button>
                  <div className="border-t border-gray-700 my-1" />
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this pool? This action cannot be undone.')) {
                        onDelete(pool.id);
                      }
                      setShowMenu(false);
                    }}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-left text-xs sm:text-sm text-red-400 hover:bg-red-900/20 flex items-center gap-1.5 sm:gap-2"
                  >
                    <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Login Info - Mobile Viewport Optimized */}
      <div className="p-3 sm:p-4 bg-gray-800/20 border-b border-gray-700/30">
        <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
          <span className="text-xs sm:text-sm text-gray-400 flex-shrink-0">Login:</span>
          <span className="text-xs sm:text-sm text-white font-mono flex-1 truncate">{pool.login_email}</span>
          <button
            onClick={() => handleCopy(pool.login_email, 'login')}
            className="p-0.5 sm:p-1 text-gray-400 hover:text-white transition-colors flex-shrink-0"
            aria-label="Copy email"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>

        {pool.login_secret && (
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-xs sm:text-sm text-gray-400 flex-shrink-0">Password:</span>
            <span className="text-xs sm:text-sm text-white font-mono flex-1 truncate">
              {showSecret ? pool.login_secret : '••••••••'}
            </span>
            <button
              onClick={() => setShowSecret(!showSecret)}
              className="p-0.5 sm:p-1 text-gray-400 hover:text-white transition-colors flex-shrink-0"
            >
              <Eye className="w-3 h-3" />
            </button>
            <button
              onClick={() => handleCopy(pool.login_secret || '', 'password')}
              className="p-0.5 sm:p-1 text-gray-400 hover:text-white transition-colors flex-shrink-0"
              aria-label="Copy password"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Time Info - Mobile Viewport Optimized */}
      <div className="p-3 sm:p-4 bg-gray-800/20 border-b border-gray-700/30">
        <div className="flex items-center gap-1 sm:gap-2 mb-1">
          <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
          <span className={`text-xs sm:text-sm font-medium ${getTimeColor()}`}>
            {getTimeUntilExpiry()}
          </span>
        </div>
        <div className="text-xs text-gray-400">
          {new Date(pool.start_at).toLocaleDateString()} - {new Date(pool.end_at).toLocaleDateString()}
        </div>
      </div>

      {/* Seat Usage - Mobile Viewport Optimized */}
      <div className="p-3 sm:p-4 bg-gray-800/20 border-b border-gray-700/30">
        <div className="flex items-center justify-between mb-1 sm:mb-2">
          <div className="flex items-center gap-1 sm:gap-2">
            <Users className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
            <span className="text-xs sm:text-sm text-gray-400">Seats</span>
          </div>
          <span className="text-xs sm:text-sm text-white font-medium">
            {pool.used_seats}/{pool.max_seats}
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-1 sm:h-2">
          <div
            className={`h-full rounded-full transition-all duration-300 ${getSeatUsageColor()}`}
            style={{ width: `${(pool.used_seats / pool.max_seats) * 100}%` }}
          />
        </div>
      </div>

      {/* Notes - Mobile Viewport Optimized */}
      {pool.notes && (
        <div className="p-3 sm:p-4 bg-gray-800/20 border-b border-gray-700/30">
          <div className="text-xs sm:text-sm text-gray-400 italic break-words">
            {pool.notes}
          </div>
        </div>
      )}

      {/* Action Button - Mobile Viewport Optimized */}
      <div className="p-3 sm:p-4">
        <button
          onClick={() => onView(pool)}
          className="w-full py-1.5 sm:py-2 text-xs sm:text-sm text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors flex items-center justify-center gap-1 sm:gap-2"
        >
          <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
          <span className="hidden xs:inline">View Details</span>
          <span className="xs:hidden">View</span>
        </button>
      </div>
    </div>
  );
}
