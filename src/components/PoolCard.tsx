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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
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
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6 hover:bg-gray-800/70 transition-all duration-200 group">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gray-700 rounded-xl flex items-center justify-center text-2xl">
            {PROVIDER_ICONS[pool.provider] || '📦'}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white capitalize">
              {pool.provider.replace('_', ' ')}
            </h3>
            <p className="text-sm text-gray-400">
              {POOL_TYPE_LABELS[pool.pool_type] || pool.pool_type}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Status Badge */}
          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(pool.status)}`}>
            {pool.status}
          </span>
          
          {/* Alive Indicator */}
          <div className={`w-2 h-2 rounded-full ${pool.is_alive ? 'bg-green-500' : 'bg-red-500'}`} />
          
          {/* Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            
            {showMenu && (
              <div className="absolute right-0 top-8 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 min-w-[160px]">
                <button
                  onClick={() => {
                    onView(pool);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  View Details
                </button>
                <button
                  onClick={() => {
                    // Handle edit
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => {
                    copyToClipboard(pool.login_email);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy Email
                </button>
                <button
                  onClick={() => {
                    handleToggleStatus();
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                >
                  {pool.status === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  {pool.status === 'paused' ? 'Resume' : 'Pause'}
                </button>
                <button
                  onClick={() => {
                    handleToggleAlive();
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                >
                  {pool.is_alive ? <HeartOff className="w-4 h-4" /> : <Heart className="w-4 h-4" />}
                  {pool.is_alive ? 'Mark Dead' : 'Mark Alive'}
                </button>
                <div className="border-t border-gray-700 my-1" />
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this pool?')) {
                      onDelete(pool.id);
                    }
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-900/20 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Login Info */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm text-gray-400">Login:</span>
          <span className="text-sm text-white font-mono">{pool.login_email}</span>
          <button
            onClick={() => copyToClipboard(pool.login_email)}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
        
        {pool.login_secret && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Password:</span>
            <span className="text-sm text-white font-mono">
              {showSecret ? pool.login_secret : '••••••••'}
            </span>
            <button
              onClick={() => setShowSecret(!showSecret)}
              className="p-1 text-gray-400 hover:text-white transition-colors"
            >
              <Eye className="w-3 h-3" />
            </button>
            <button
              onClick={() => copyToClipboard(pool.login_secret || '')}
              className="p-1 text-gray-400 hover:text-white transition-colors"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Time Info */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className={`text-sm font-medium ${getTimeColor()}`}>
            {getTimeUntilExpiry()}
          </span>
        </div>
        <div className="text-xs text-gray-500">
          {new Date(pool.start_at).toLocaleDateString()} - {new Date(pool.end_at).toLocaleDateString()}
        </div>
      </div>

      {/* Seat Usage */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">Seats</span>
          </div>
          <span className="text-sm text-white font-medium">
            {pool.used_seats}/{pool.max_seats}
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${getSeatUsageColor()}`}
            style={{ width: `${(pool.used_seats / pool.max_seats) * 100}%` }}
          />
        </div>
      </div>

      {/* Notes */}
      {pool.notes && (
        <div className="text-sm text-gray-400 italic">
          {pool.notes}
        </div>
      )}

      {/* Click to view */}
      <button
        onClick={() => onView(pool)}
        className="w-full mt-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors"
      >
        View Details →
      </button>
    </div>
  );
}
