import React, { useState, useEffect } from 'react';
import { 
  X, 
  Copy, 
  Eye, 
  EyeOff, 
  Users, 
  Clock, 
  Mail, 
  Lock, 
  FileText,
  Edit,
  Trash2,
  Pause,
  Play,
  Heart,
  HeartOff,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { ResourcePool, ResourcePoolSeat, PoolStats } from '../types/inventory';
import { getPoolWithSeats, getPoolStats, updateResourcePool, deleteResourcePool, assignSeat, unassignSeat } from '../lib/inventory';
import { PROVIDER_ICONS, STATUS_COLORS, POOL_TYPE_LABELS, STATUS_LABELS } from '../constants/provisioning';
import SeatAssignmentModal from './SeatAssignmentModal';
import PoolEditModal from './PoolEditModal';

interface PoolDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  pool: ResourcePool | null;
  onUpdate: (pool: ResourcePool) => void;
  onDelete: (poolId: string) => void;
}

export function PoolDetailModal({ isOpen, onClose, pool, onUpdate, onDelete }: PoolDetailModalProps) {
  const [poolWithSeats, setPoolWithSeats] = useState<ResourcePool & { seats: ResourcePoolSeat[] } | null>(null);
  const [stats, setStats] = useState<PoolStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [editing, setEditing] = useState(false);
  const [seatAssignmentModal, setSeatAssignmentModal] = useState<{
    isOpen: boolean;
    seat: ResourcePoolSeat | null;
  }>({ isOpen: false, seat: null });
  const [editModalOpen, setEditModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen && pool) {
      fetchPoolDetails();
    }
  }, [isOpen, pool]);

  const fetchPoolDetails = async () => {
    if (!pool) return;
    
    setLoading(true);
    try {
      const [poolResult, statsResult] = await Promise.all([
        getPoolWithSeats(pool.id),
        getPoolStats(pool.id)
      ]);
      
      if (poolResult.data) {
        setPoolWithSeats(poolResult.data);
      }
      if (statsResult.data) {
        setStats(statsResult.data[0] || null);
      }
    } catch (error) {
      console.error('Error fetching pool details:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

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
    if (!pool) return '';
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
    if (!pool) return 'text-gray-400';
    const now = new Date();
    const endDate = new Date(pool.end_at);
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'text-red-400';
    if (diffDays <= 1) return 'text-red-400';
    if (diffDays <= 3) return 'text-amber-400';
    return 'text-gray-400';
  };

  const getSeatStatusIcon = (status: string) => {
    switch (status) {
      case 'assigned':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'reserved':
        return <Clock className="w-4 h-4 text-amber-400" />;
      case 'available':
        return <XCircle className="w-4 h-4 text-gray-400" />;
      default:
        return <XCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getSeatStatusColor = (status: string) => {
    switch (status) {
      case 'assigned':
        return 'bg-green-900/30 text-green-400 border-green-700/50';
      case 'reserved':
        return 'bg-amber-900/30 text-amber-400 border-amber-700/50';
      case 'available':
        return 'bg-gray-900/30 text-gray-400 border-gray-700/50';
      default:
        return 'bg-gray-900/30 text-gray-400 border-gray-700/50';
    }
  };

  const handleToggleAlive = async () => {
    if (!pool) return;
    try {
      const { data, error } = await updateResourcePool(pool.id, { is_alive: !pool.is_alive });
      if (error) throw error;
      onUpdate(data);
    } catch (error) {
      console.error('Error updating pool:', error);
    }
  };

  const handleToggleStatus = async () => {
    if (!pool) return;
    const newStatus = pool.status === 'paused' ? 'active' : 'paused';
    try {
      const { data, error } = await updateResourcePool(pool.id, { status: newStatus });
      if (error) throw error;
      onUpdate(data);
    } catch (error) {
      console.error('Error updating pool:', error);
    }
  };

  const handleSeatAction = (seat: ResourcePoolSeat) => {
    setSeatAssignmentModal({ isOpen: true, seat });
  };

  const handleSeatUpdated = async () => {
    await fetchPoolDetails();
  };

  const closeSeatAssignmentModal = () => {
    setSeatAssignmentModal({ isOpen: false, seat: null });
  };

  const handleDelete = async () => {
    if (!pool) return;
    
    if (confirm('Are you sure you want to delete this pool? This action cannot be undone.')) {
      try {
        await deleteResourcePool(pool.id);
        onDelete(pool.id);
        onClose();
      } catch (error) {
        console.error('Error deleting pool:', error);
        alert('Failed to delete pool');
      }
    }
  };

  if (!isOpen || !pool) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-700 rounded-xl flex items-center justify-center text-2xl">
              {PROVIDER_ICONS[pool.provider] || '📦'}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white capitalize">
                {pool.provider.replace('_', ' ')} Pool
              </h2>
              <p className="text-sm text-gray-400">
                {POOL_TYPE_LABELS[pool.pool_type] || pool.pool_type}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Status Badge */}
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(pool.status)}`}>
              {STATUS_LABELS[pool.status] || pool.status}
            </span>
            
            {/* Alive Indicator */}
            <div className={`w-3 h-3 rounded-full ${pool.is_alive ? 'bg-green-500' : 'bg-red-500'}`} />
            
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Pool Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Login Credentials */}
              <div className="bg-gray-800/50 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Login Credentials
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400 w-16">Email:</span>
                    <span className="text-sm text-white font-mono flex-1">{pool.login_email}</span>
                    <button
                      onClick={() => copyToClipboard(pool.login_email)}
                      className="p-1 text-gray-400 hover:text-white transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {pool.login_secret && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400 w-16">Password:</span>
                      <span className="text-sm text-white font-mono flex-1">
                        {showSecret ? pool.login_secret : '••••••••'}
                      </span>
                      <button
                        onClick={() => setShowSecret(!showSecret)}
                        className="p-1 text-gray-400 hover:text-white transition-colors"
                      >
                        {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => copyToClipboard(pool.login_secret || '')}
                        className="p-1 text-gray-400 hover:text-white transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Pool Stats */}
              <div className="bg-gray-800/50 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Pool Statistics
                </h3>
                {stats ? (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">Total Seats:</span>
                      <span className="text-sm text-white font-medium">{stats.total_seats}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">Used Seats:</span>
                      <span className="text-sm text-white font-medium">{stats.used_seats}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">Available:</span>
                      <span className="text-sm text-white font-medium">{stats.available_seats}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2 mt-3">
                      <div 
                        className="bg-green-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(stats.used_seats / stats.total_seats) * 100}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">Loading stats...</div>
                )}
              </div>
            </div>

            {/* Time Info */}
            <div className="bg-gray-800/50 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Validity Period
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm text-gray-400">Start Date:</span>
                  <p className="text-white font-medium">{new Date(pool.start_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-400">End Date:</span>
                  <p className="text-white font-medium">{new Date(pool.end_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-400">Time Remaining:</span>
                  <p className={`font-medium ${getTimeColor()}`}>{getTimeUntilExpiry()}</p>
                </div>
              </div>
            </div>

            {/* Notes */}
            {pool.notes && (
              <div className="bg-gray-800/50 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Notes
                </h3>
                <p className="text-gray-300">{pool.notes}</p>
              </div>
            )}

            {/* Seats Grid */}
            {poolWithSeats && (
              <div className="bg-gray-800/50 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Seats ({poolWithSeats.seats.length})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {poolWithSeats.seats.map(seat => (
                    <div
                      key={seat.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-gray-700/50 ${getSeatStatusColor(seat.seat_status)}`}
                      onClick={() => handleSeatAction(seat)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Seat {seat.seat_index}</span>
                        {getSeatStatusIcon(seat.seat_status)}
                      </div>
                      {seat.assigned_email && (
                        <div className="text-xs text-gray-300 truncate">
                          {seat.assigned_email}
                        </div>
                      )}
                      {seat.assigned_at && (
                        <div className="text-xs text-gray-400">
                          {new Date(seat.assigned_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-700">
              <button
                onClick={handleToggleStatus}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center gap-2"
              >
                {pool.status === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                {pool.status === 'paused' ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={handleToggleAlive}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center gap-2"
              >
                {pool.is_alive ? <HeartOff className="w-4 h-4" /> : <Heart className="w-4 h-4" />}
                {pool.is_alive ? 'Mark Dead' : 'Mark Alive'}
              </button>
              <button
                onClick={() => setEditModalOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Seat Assignment Modal */}
      <SeatAssignmentModal
        isOpen={seatAssignmentModal.isOpen}
        onClose={closeSeatAssignmentModal}
        seat={seatAssignmentModal.seat}
        poolId={pool?.id || ''}
        onSeatUpdated={handleSeatUpdated}
      />

      {/* Pool Edit Modal */}
      <PoolEditModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        pool={pool}
        onPoolUpdated={(updatedPool) => {
          onUpdate(updatedPool);
          setEditModalOpen(false);
        }}
      />
    </div>
  );
}
