import React, { useState, useEffect } from 'react';
import { Archive, Users, AlertTriangle, CheckCircle } from 'lucide-react';
import { ResourcePool } from '../types/inventory';
import { getAvailablePoolsForService, getAvailableSeatsInPool, linkSubscriptionToPool, assignSeat, assignNextFreeSeat } from '../lib/inventory';
import { SERVICE_PROVISIONING, PROVIDER_ICONS, POOL_TYPE_LABELS } from '../constants/provisioning';
import SearchableDropdown from './SearchableDropdown';

interface LinkResourceSectionProps {
  serviceProvider: string;
  subscriptionId?: string;
  customerEmail?: string;
  onResourceLinked?: (poolId: string, seatId: string) => void;
}

export function LinkResourceSection({ serviceProvider, subscriptionId, customerEmail, onResourceLinked }: LinkResourceSectionProps) {
  const [availablePools, setAvailablePools] = useState<ResourcePool[]>([]);
  const [availableSeats, setAvailableSeats] = useState<any[]>([]);
  const [selectedPoolId, setSelectedPoolId] = useState('');
  const [selectedSeatId, setSelectedSeatId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check if this service has inventory tracking
  const hasInventory = SERVICE_PROVISIONING[serviceProvider] !== null;

  useEffect(() => {
    if (hasInventory && serviceProvider) {
      fetchAvailablePools();
    }
  }, [serviceProvider, hasInventory]);

  useEffect(() => {
    if (selectedPoolId) {
      fetchAvailableSeats();
    }
  }, [selectedPoolId]);

  const fetchAvailablePools = async () => {
    try {
      setLoading(true);
      console.log('Fetching pools for service provider:', serviceProvider);
      const { data, error } = await getAvailablePoolsForService(serviceProvider);
      if (error) throw error;
      
      console.log('Raw pools data:', data);
      
      // Filter pools that have available seats
      const poolsWithAvailableSeats = (data || []).filter(pool => 
        pool.used_seats < pool.max_seats
      );
      
      console.log('Filtered pools with available seats:', poolsWithAvailableSeats);
      setAvailablePools(poolsWithAvailableSeats);
    } catch (error) {
      console.error('Error fetching pools:', error);
      setError('Failed to load available pools');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableSeats = async () => {
    if (!selectedPoolId) return;
    
    try {
      const { data, error } = await getAvailableSeatsInPool(selectedPoolId);
      if (error) throw error;
      setAvailableSeats(data || []);
    } catch (error) {
      console.error('Error fetching seats:', error);
      setError('Failed to load available seats');
    }
  };

  const handleLinkResource = async () => {
    if (!selectedPoolId || !subscriptionId || !customerEmail) return;
    
    try {
      setLoading(true);
      setError('');
      
      console.log('Linking resource:', {
        selectedPoolId,
        selectedSeatId,
        subscriptionId,
        customerEmail
      });
      
      let assignedSeatId: string | undefined;
      
      if (selectedSeatId) {
        // Assign specific seat
        console.log('Assigning specific seat:', selectedSeatId);
        const { data: seatData, error: assignError } = await assignSeat(selectedSeatId, {
          email: customerEmail,
          subscriptionId: subscriptionId,
        });
        
        if (assignError) throw assignError;
        assignedSeatId = seatData?.id;
        console.log('Assigned specific seat:', assignedSeatId);
      } else {
        // Auto-assign next available seat
        console.log('Auto-assigning next available seat in pool:', selectedPoolId);
        const { data: seatId, error: assignError } = await assignNextFreeSeat(selectedPoolId, {
          email: customerEmail,
          subscriptionId: subscriptionId,
        });
        
        if (assignError) {
          console.error('Auto-assignment error:', assignError);
          if (assignError.code === 'P0001') {
            throw new Error('No available seats in the selected pool');
          }
          throw assignError;
        }
        assignedSeatId = seatId;
        console.log('Auto-assigned seat:', assignedSeatId);
      }
      
      // Then link the subscription to the pool
      console.log('Linking subscription to pool:', { subscriptionId, selectedPoolId, assignedSeatId });
      const { error } = await linkSubscriptionToPool(
        subscriptionId,
        selectedPoolId,
        assignedSeatId
      );
      
      if (error) throw error;
      
      console.log('Successfully linked resource');
      onResourceLinked?.(selectedPoolId, assignedSeatId || '');
      setError('');
    } catch (error) {
      console.error('Error linking resource:', error);
      setError(error instanceof Error ? error.message : 'Failed to link resource');
    } finally {
      setLoading(false);
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

  const getTimeUntilExpiry = (endAt: string) => {
    const now = new Date();
    const endDate = new Date(endAt);
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Expired';
    if (diffDays === 0) return 'Expires today';
    if (diffDays === 1) return 'Expires tomorrow';
    if (diffDays <= 7) return `Expires in ${diffDays} days`;
    return `Expires in ${Math.ceil(diffDays / 30)} months`;
  };

  if (!hasInventory) {
    return null; // Don't show the section if service doesn't have inventory tracking
  }

  if (!customerEmail) {
    return (
      <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-4">
        <div className="flex items-center gap-2 text-amber-300">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-medium">Customer email required</span>
        </div>
        <p className="mt-2 text-sm text-amber-200">
          Please enter a customer email in the "Login Email" field above to link this subscription to a resource pool seat.
        </p>
      </div>
    );
  }

  const poolOptions = availablePools.map(pool => ({
    value: pool.id,
    label: `${PROVIDER_ICONS[pool.provider] || '📦'} ${pool.login_email} (${pool.used_seats}/${pool.max_seats} seats) - ${getTimeUntilExpiry(pool.end_at)}`
  }));

  const seatOptions = availableSeats.map(seat => ({
    value: seat.id,
    label: `Seat ${seat.seat_index}`
  }));

  return (
    <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Archive className="w-5 h-5 text-green-400" />
        <h3 className="text-lg font-semibold text-white">Link Resource Pool</h3>
      </div>
      
      <div className="space-y-4">
        {/* Pool Selection */}
        <div>
          <SearchableDropdown
            label="Resource Pool"
            options={[
              { value: '', label: 'Select a pool' },
              ...poolOptions
            ]}
            value={selectedPoolId}
            onChange={(value) => {
              setSelectedPoolId(value);
              setSelectedSeatId('');
            }}
            placeholder="Select a resource pool"
            searchPlaceholder="Search pools..."
            disabled={loading}
            showSearchThreshold={5}
          />
          {selectedPoolId && (
            <div className="mt-2 text-sm text-gray-400">
              {(() => {
                const pool = availablePools.find(p => p.id === selectedPoolId);
                if (!pool) return null;
                return (
                  <div className="flex items-center gap-2">
                    <span className={getPoolStatusColor(pool.status)}>
                      {pool.status === 'active' ? <CheckCircle className="w-4 h-4 inline mr-1" /> : <AlertTriangle className="w-4 h-4 inline mr-1" />}
                      {pool.status}
                    </span>
                    <span>•</span>
                    <span>{POOL_TYPE_LABELS[pool.pool_type] || pool.pool_type}</span>
                    <span>•</span>
                    <span>{pool.used_seats}/{pool.max_seats} seats used</span>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Seat Selection */}
        {selectedPoolId && (
          <div>
            <SearchableDropdown
              label="Seat Assignment"
              options={[
                { value: '', label: 'Auto-assign next available' },
                ...seatOptions
              ]}
              value={selectedSeatId}
              onChange={(value) => setSelectedSeatId(value)}
              placeholder="Auto-assign or select specific seat"
              searchPlaceholder="Search seats..."
              disabled={loading}
              showSearchThreshold={10}
            />
            <p className="mt-1 text-sm text-gray-400">
              {selectedSeatId ? 'Specific seat will be assigned' : 'Next available seat will be automatically assigned'}
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Link Button */}
        {selectedPoolId && (
          <button
            onClick={handleLinkResource}
            disabled={loading}
            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Linking...
              </>
            ) : (
              <>
                <Users className="w-4 h-4" />
                Link Resource
              </>
            )}
          </button>
        )}

        {/* Info */}
        <div className="text-sm text-gray-400">
          <p>This will link the subscription to a resource pool seat for inventory tracking.</p>
          <p>Only pools with available seats and active/overdue status are shown.</p>
        </div>
      </div>
    </div>
  );
}
