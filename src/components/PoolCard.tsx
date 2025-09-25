import React, { useState } from 'react';
import { 
  MoreVertical, 
  Eye, 
  Edit, 
  Trash2, 
  Copy, 
  Pause, 
  Play, 
  Heart, 
  HeartOff,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { ResourcePool } from '../types/inventory';
import { PROVIDER_ICONS, STATUS_COLORS, POOL_TYPE_LABELS } from '../constants/provisioning';
import { copyToClipboard } from '../lib/toast';

interface PoolCardProps {
  pool: ResourcePool;
  onUpdate: (pool: ResourcePool) => void;
  onDelete: (poolId: string) => void;
  onView: (pool: ResourcePool) => void;
}

export function PoolCard({ pool, onUpdate, onDelete, onView }: PoolCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'bg-green-900/30 text-green-400 border-green-700/50',
      paused: 'bg-slate-900/30 text-slate-400 border-slate-700/50',
      completed: 'bg-indigo-900/30 text-indigo-400 border-indigo-700/50',
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
    return 'bg-green-500';
  };

  const handleCopy = async (text: string, type: 'login' | 'password') => {
    const message = type === 'login' ? 'Login copied to clipboard' : 'Password copied to clipboard';
    await copyToClipboard(text, message);
  };

  const handleToggleAlive = async () => {
    // This would call an API to toggle the alive status
    onUpdate({ ...pool, is_alive: !pool.is_alive });
  };

  const handleToggleStatus = async () => {
    const newStatus = pool.status === 'paused' ? 'active' : 'paused';
    onUpdate({ ...pool, status: newStatus });
  };

  return (
    <div className="w-full max-w-full rounded-2xl border border-gray-700/50 bg-gray-800/50 hover:bg-gray-800/70 transition-all duration-200 group">
      {/* Header - Mobile Viewport Optimized */}
      <div className="p-3 sm:p-4 border-b border-gray-700/30">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-gray-700 rounded-lg flex items-center justify-center text-sm sm:text-lg lg:text-xl flex-shrink-0">
              {PROVIDER_ICONS[pool.provider] || '📦'}
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
            <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium border ${getStatusColor(pool.status)}`}>
              {pool.status}
            </span>
            
            {/* Alive Indicator */}
            <div className={`w-2 h-2 rounded-full ${pool.is_alive ? 'bg-green-500' : 'bg-red-500'}`} />
            
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
                      onView(pool); // Open the detail modal which has the edit functionality
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
                  <div className="border-t border-gray-700 my-1" />
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this pool?')) {
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
