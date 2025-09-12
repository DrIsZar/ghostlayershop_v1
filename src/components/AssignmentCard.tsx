import React from 'react';
import { Calendar, Mail, User, Package, Clock } from 'lucide-react';
import { AssignmentWithDetails } from '../types/inventory';
import { PROVIDER_ICONS, POOL_TYPE_LABELS, STATUS_LABELS } from '../constants/provisioning';

interface AssignmentCardProps {
  assignment: AssignmentWithDetails;
}

export function AssignmentCard({ assignment }: AssignmentCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeSinceAssignment = (assignedAt: string) => {
    const now = new Date();
    const assigned = new Date(assignedAt);
    const diffMs = now.getTime() - assigned.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  const getPoolStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-400';
      case 'overdue':
        return 'text-amber-400';
      case 'expired':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6 hover:border-gray-600/50 transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gray-700 rounded-xl flex items-center justify-center text-lg">
            {PROVIDER_ICONS[assignment.resource_pools.provider] || '📦'}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              Seat #{assignment.seat_index}
            </h3>
            <p className="text-sm text-gray-400">
              {assignment.resource_pools.provider.replace('_', ' ').toUpperCase()}
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <div className={`text-sm font-medium ${getPoolStatusColor(assignment.resource_pools.status)}`}>
            {STATUS_LABELS[assignment.resource_pools.status] || assignment.resource_pools.status}
          </div>
          <div className="text-xs text-gray-400">
            {POOL_TYPE_LABELS[assignment.resource_pools.pool_type] || assignment.resource_pools.pool_type}
          </div>
        </div>
      </div>

      {/* Assignment Details */}
      <div className="space-y-3 mb-4">
        {/* Assigned Email */}
        {assignment.assigned_email && (
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">{assignment.assigned_email}</span>
          </div>
        )}

        {/* Client Information */}
        {assignment.clients && (
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">
              {assignment.clients.name} ({assignment.clients.email})
            </span>
          </div>
        )}

        {/* Subscription Information */}
        {assignment.subscriptions && (
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">
              Subscription #{assignment.subscriptions.id.slice(0, 8)}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              assignment.subscriptions.status === 'active' ? 'bg-green-900/30 text-green-400' :
              assignment.subscriptions.status === 'paused' ? 'bg-yellow-900/30 text-yellow-400' :
              'bg-red-900/30 text-red-400'
            }`}>
              {assignment.subscriptions.status}
            </span>
          </div>
        )}

        {/* Pool Information */}
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-300">
            {assignment.resource_pools.login_email}
          </span>
        </div>
      </div>

      {/* Assignment Time */}
      {assignment.assigned_at && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">Assigned</span>
          </div>
          <div className="text-right">
            <div className="text-sm text-white">
              {formatDate(assignment.assigned_at)}
            </div>
            <div className="text-xs text-gray-400">
              {getTimeSinceAssignment(assignment.assigned_at)}
            </div>
          </div>
        </div>
      )}

      {/* Pool Expiry */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400">Pool Expires</span>
        </div>
        <div className="text-sm text-gray-300">
          {formatDate(assignment.resource_pools.end_at)}
        </div>
      </div>

    </div>
  );
}
