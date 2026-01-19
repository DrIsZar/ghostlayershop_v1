import React, { useState, useEffect } from 'react';
import { X, Mail, User, Link, Save, Calendar } from 'lucide-react';
import { ResourcePoolSeat } from '../types/inventory';
import { assignSeat, unassignSeat } from '../lib/inventory';
import { clientsDb } from '../lib/clients';
import { subscriptionService } from '../lib/subscriptionService';
import { supabase } from '../lib/supabase';
import { Client } from '../types/client';
import { Subscription } from '../types/subscription';
import SearchableDropdown from './SearchableDropdown';
import { shouldIgnoreKeyboardEvent } from '../lib/useKeyboardShortcuts';

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

  // Keyboard shortcuts: Enter to save, Escape to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger if typing in an input/textarea
      if (shouldIgnoreKeyboardEvent(event) && event.key !== 'Escape') {
        return;
      }

      if (event.key === 'Enter' && !loading) {
        event.preventDefault();
        const form = document.querySelector('form');
        if (form) {
          form.requestSubmit();
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, loading, onClose]);

  if (!isOpen || !seat) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100]" style={{ top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', margin: 0, padding: '16px' }}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">
            {seat.seat_status === 'assigned' ? 'Edit Seat Assignment' : 'Assign Seat'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-700/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
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
                <span className="ml-2 text-xs text-white">
                  (auto-filled from subscription)
                </span>
              )}
            </label>
            <input
              type="text"
              value={formData.assigned_email}
              onChange={(e) => handleInputChange('assigned_email', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
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
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
            {errors.assigned_at && (
              <p className="mt-1 text-sm text-red-400">{errors.assigned_at}</p>
            )}
          </div>

          {/* Client Selection */}
          <div>
            <SearchableDropdown
              label="Link to Client (Optional)"
              icon={<User className="w-4 h-4" />}
              options={[
                { value: '', label: 'Select a client...' },
                ...clients.map(client => ({
                  value: client.id,
                  label: `${client.name} (${client.email})`
                }))
              ]}
              value={formData.assigned_client_id}
              onChange={(value) => handleInputChange('assigned_client_id', value)}
              placeholder="Select a client..."
              searchPlaceholder="Search clients..."
              showSearchThreshold={1}
            />
          </div>

          {/* Subscription Selection */}
          <div>
            <SearchableDropdown
              label="Link to Subscription (Optional)"
              icon={<Link className="w-4 h-4" />}
              options={(() => {
                const filteredSubscriptions = subscriptions.filter(subscription =>
                  !formData.assigned_client_id || subscription.clientId === formData.assigned_client_id
                );

                const options = [
                  { value: '', label: 'Select a subscription...' }
                ];

                if (filteredSubscriptions.length === 0 && formData.assigned_client_id) {
                  options.push({
                    value: '',
                    label: 'No subscriptions found for selected client',
                    disabled: true
                  });
                } else {
                  options.push(...filteredSubscriptions.map(subscription => ({
                    value: subscription.id,
                    label: `${subscription.service_name} (${subscription.customer_login})`
                  })));
                }

                return options;
              })()}
              value={formData.assigned_subscription_id}
              onChange={(value) => handleInputChange('assigned_subscription_id', value)}
              placeholder="Select a subscription..."
              searchPlaceholder="Search subscriptions..."
              showSearchThreshold={1}
            />
            {formData.assigned_client_id && subscriptions.filter(s => s.clientId === formData.assigned_client_id).length === 0 && (
              <p className="mt-1 text-sm text-amber-400">
                No subscriptions found for the selected client
              </p>
            )}
            {formData.assigned_subscription_id && (
              <p className="mt-1 text-sm text-white">
                Customer email will be automatically filled from the selected subscription
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-6 border-t border-gray-700">
            {seat.seat_status === 'assigned' && (
              <button
                type="button"
                onClick={handleUnassign}
                disabled={loading}
                className="px-6 py-3 ghost-button-danger flex items-center gap-2"
              >
                Unassign Seat
              </button>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 ghost-button-primary flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {seat.seat_status === 'assigned' ? 'Update Assignment' : 'Assign Seat'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
