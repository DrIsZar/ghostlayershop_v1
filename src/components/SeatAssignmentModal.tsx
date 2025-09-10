import React, { useState, useEffect } from 'react';
import { X, Mail, User, Link, Save, Calendar } from 'lucide-react';
import { ResourcePoolSeat } from '../types/inventory';
import { assignSeat, unassignSeat } from '../lib/inventory';
import { clientsDb } from '../lib/clients';
import { subscriptionService } from '../lib/subscriptionService';
import { supabase } from '../lib/supabase';
import { Client } from '../types/client';
import { Subscription } from '../types/subscription';

interface SeatAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  seat: ResourcePoolSeat | null;
  poolId: string;
  onSeatUpdated: () => void;
}

export default function SeatAssignmentModal({ 
  isOpen, 
  onClose, 
  seat, 
  poolId, 
  onSeatUpdated 
}: SeatAssignmentModalProps) {
  const [formData, setFormData] = useState({
    assigned_email: '',
    assigned_client_id: '',
    assigned_subscription_id: '',
    assigned_at: '',
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load clients and subscriptions when modal opens
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // Populate form when seat changes
  useEffect(() => {
    if (seat) {
      setFormData({
        assigned_email: seat.assigned_email || '',
        assigned_client_id: seat.assigned_client_id || '',
        assigned_subscription_id: seat.assigned_subscription_id || '',
        assigned_at: seat.assigned_at ? new Date(seat.assigned_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      });
    } else {
      setFormData({
        assigned_email: '',
        assigned_client_id: '',
        assigned_subscription_id: '',
        assigned_at: new Date().toISOString().split('T')[0],
      });
    }
    setErrors({});
  }, [seat]);

  const loadData = async () => {
    try {
      const [clientsData, subscriptionsData] = await Promise.all([
        clientsDb.getAll(),
        subscriptionService.listSubscriptions()
      ]);
      
      setClients(clientsData || []);
      
      // Fetch service names for subscriptions
      const subscriptionsWithNames = await Promise.all(
        (subscriptionsData || []).map(async (subscription) => {
          try {
            // Get service name
            const { data: service } = await supabase
              .from('services')
              .select('product_service')
              .eq('id', subscription.serviceId)
              .single();
            
            // Get client name
            const client = clientsData?.find(c => c.id === subscription.clientId);
            
            return {
              ...subscription,
              service_name: service?.product_service || 'Unknown Service',
              client_name: client?.name || 'Unknown Client',
              customer_login: subscription.notes || 'No login email'
            };
          } catch (error) {
            console.error('Error fetching names for subscription:', subscription.id, error);
            return {
              ...subscription,
              service_name: 'Unknown Service',
              client_name: 'Unknown Client'
            };
          }
        })
      );
      
      setSubscriptions(subscriptionsWithNames);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.assigned_email) {
      newErrors.assigned_email = 'Customer login is required';
    }

    if (!formData.assigned_at) {
      newErrors.assigned_at = 'Assignment date is required';
    } else if (isNaN(new Date(formData.assigned_at).getTime())) {
      newErrors.assigned_at = 'Please enter a valid assignment date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !seat) return;

    setLoading(true);
    try {
      if (seat.seat_status === 'assigned') {
        // Update existing assignment
        await assignSeat(seat.id, {
          email: formData.assigned_email,
          clientId: formData.assigned_client_id || undefined,
          subscriptionId: formData.assigned_subscription_id || undefined,
          assignedAt: new Date(formData.assigned_at).toISOString(),
        });
      } else {
        // Assign new seat
        await assignSeat(seat.id, {
          email: formData.assigned_email,
          clientId: formData.assigned_client_id || undefined,
          subscriptionId: formData.assigned_subscription_id || undefined,
          assignedAt: new Date(formData.assigned_at).toISOString(),
        });
      }
      
      onSeatUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating seat:', error);
      alert('Failed to update seat assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleUnassign = async () => {
    if (!seat) return;

    setLoading(true);
    try {
      await unassignSeat(seat.id);
      onSeatUpdated();
      onClose();
    } catch (error) {
      console.error('Error unassigning seat:', error);
      alert('Failed to unassign seat');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // If client changes, clear subscription selection since available subscriptions will be different
      if (field === 'assigned_client_id') {
        newData.assigned_subscription_id = '';
      }
      
      // If subscription changes, update customer email to match the subscription's customer login
      if (field === 'assigned_subscription_id' && value) {
        const selectedSubscription = subscriptions.find(sub => sub.id === value);
        if (selectedSubscription && selectedSubscription.customer_login && selectedSubscription.customer_login !== 'No login email') {
          newData.assigned_email = selectedSubscription.customer_login;
        }
      }
      
      return newData;
    });
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (!isOpen || !seat) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">
            {seat.seat_status === 'assigned' ? 'Edit Seat Assignment' : 'Assign Seat'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Seat Info */}
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Seat Information</h3>
            <p className="text-white">Seat #{seat.seat_index}</p>
            <p className="text-sm text-gray-400">Pool ID: {poolId}</p>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Mail className="w-4 h-4 inline mr-2" />
              Customer Login *
              {formData.assigned_subscription_id && (
                <span className="ml-2 text-xs text-blue-400">
                  (auto-filled from subscription)
                </span>
              )}
            </label>
            <input
              type="text"
              value={formData.assigned_email}
              onChange={(e) => handleInputChange('assigned_email', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500"
              placeholder="customer@example.com or customer@example.com:password"
            />
            {errors.assigned_email && (
              <p className="mt-1 text-sm text-red-400">{errors.assigned_email}</p>
            )}
          </div>

          {/* Assignment Date */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              Assignment Date *
            </label>
            <input
              type="date"
              value={formData.assigned_at}
              onChange={(e) => handleInputChange('assigned_at', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500"
            />
            {errors.assigned_at && (
              <p className="mt-1 text-sm text-red-400">{errors.assigned_at}</p>
            )}
          </div>

          {/* Client Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <User className="w-4 h-4 inline mr-2" />
              Link to Client (Optional)
            </label>
            <select
              value={formData.assigned_client_id}
              onChange={(e) => handleInputChange('assigned_client_id', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500"
            >
              <option value="">Select a client...</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.email})
                </option>
              ))}
            </select>
          </div>

          {/* Subscription Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Link className="w-4 h-4 inline mr-2" />
              Link to Subscription (Optional)
            </label>
            <select
              value={formData.assigned_subscription_id}
              onChange={(e) => handleInputChange('assigned_subscription_id', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500"
            >
              <option value="">Select a subscription...</option>
              {(() => {
                const filteredSubscriptions = subscriptions.filter(subscription => 
                  !formData.assigned_client_id || subscription.clientId === formData.assigned_client_id
                );
                
                if (filteredSubscriptions.length === 0 && formData.assigned_client_id) {
                  return (
                    <option value="" disabled>
                      No subscriptions found for selected client
                    </option>
                  );
                }
                
                return filteredSubscriptions.map(subscription => (
                  <option key={subscription.id} value={subscription.id}>
                    {subscription.service_name} ({subscription.customer_login})
                  </option>
                ));
              })()}
            </select>
            {formData.assigned_client_id && subscriptions.filter(s => s.clientId === formData.assigned_client_id).length === 0 && (
              <p className="mt-1 text-sm text-amber-400">
                No subscriptions found for the selected client
              </p>
            )}
            {formData.assigned_subscription_id && (
              <p className="mt-1 text-sm text-blue-400">
                Customer email will be automatically filled from the selected subscription
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-700">
            {seat.seat_status === 'assigned' && (
              <button
                type="button"
                onClick={handleUnassign}
                disabled={loading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white font-medium rounded-lg transition-colors duration-200 flex items-center gap-2"
              >
                Unassign Seat
              </button>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white font-medium rounded-lg transition-colors duration-200 flex items-center gap-2 ml-auto"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : (seat.seat_status === 'assigned' ? 'Update Assignment' : 'Assign Seat')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
