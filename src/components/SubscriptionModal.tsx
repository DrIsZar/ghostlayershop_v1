import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, User, Package, Info, Clock, Mail, Archive, Edit, Unlink } from 'lucide-react';
import { Subscription, RenewalStrategyKey } from '../types/subscription';
import { subscriptionService } from '../lib/subscriptionService';
import { supabase } from '../lib/supabase';
import { calculateEndDateFromDuration, formatServiceTitleWithDuration, parseServiceDuration } from '../lib/subscriptionUtils';
import SearchableDropdown from './SearchableDropdown';
import { LinkResourceSection } from './LinkResourceSection';
import { SERVICE_PROVISIONING } from '../constants/provisioning';
import { getResourcePool, getPoolSeats, unlinkSubscriptionFromPool } from '../lib/inventory';
import { ResourcePool, ResourcePoolSeat } from '../types/inventory';
import { PROVIDER_ICONS, POOL_TYPE_LABELS, STATUS_LABELS } from '../constants/provisioning';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscriptionCreated: (subscription: Subscription) => void;
  onSubscriptionUpdated?: (subscription: Subscription) => void;
  saleId?: string;
  initialServiceId?: string;
  initialClientId?: string;
  editingSubscription?: Subscription | null;
}

interface Service {
  id: string;
  product_service: string;
  logo_url?: string;
  duration?: string;
  cost?: number;
  selling_price?: number;
}

interface Client {
  id: string;
  name: string;
  email: string;
}

export default function SubscriptionModal({ 
  isOpen, 
  onClose, 
  onSubscriptionCreated,
  onSubscriptionUpdated,
  saleId,
  initialServiceId,
  initialClientId,
  editingSubscription
}: SubscriptionModalProps) {
  const [formData, setFormData] = useState({
    serviceId: initialServiceId || '',
    clientId: initialClientId || '',
    startDate: new Date().toISOString().split('T')[0], // Default to today
    strategy: 'MONTHLY' as RenewalStrategyKey,
    intervalDays: 30,
    isAutoRenew: true,
    notes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [createdSubscriptionId, setCreatedSubscriptionId] = useState<string | null>(null);
  const [resourcePool, setResourcePool] = useState<ResourcePool | null>(null);
  const [assignedSeat, setAssignedSeat] = useState<ResourcePoolSeat | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Update form data when initial values change
  useEffect(() => {
    if (initialServiceId !== undefined || initialClientId !== undefined) {
      setFormData(prev => ({
        ...prev,
        serviceId: initialServiceId || '',
        clientId: initialClientId || ''
      }));
    }
  }, [initialServiceId, initialClientId]);

  // Populate form data when editing existing subscription
  useEffect(() => {
    if (editingSubscription) {
      setIsEditing(true);
      setFormData({
        serviceId: editingSubscription.serviceId,
        clientId: editingSubscription.clientId,
        startDate: editingSubscription.startedAt ? editingSubscription.startedAt.split('T')[0] : new Date().toISOString().split('T')[0],
        strategy: editingSubscription.strategy,
        intervalDays: editingSubscription.intervalDays || 30,
        isAutoRenew: editingSubscription.isAutoRenew || false,
        notes: editingSubscription.notes || ''
      });
      setCreatedSubscriptionId(editingSubscription.id);
    } else {
      setIsEditing(false);
    }
  }, [editingSubscription]);

  // Ensure start date is valid
  useEffect(() => {
    if (!formData.startDate || isNaN(new Date(formData.startDate).getTime())) {
      setFormData(prev => ({
        ...prev,
        startDate: new Date().toISOString().split('T')[0]
      }));
    }
  }, [formData.startDate]);

  // Calculate end date based on service duration and start date
  const calculateEndDate = () => {
    if (!selectedService?.duration || !formData.startDate) return null;
    
    try {
      return calculateEndDateFromDuration(selectedService.duration, formData.startDate);
    } catch (error) {
      console.error('Error calculating end date:', error);
      return null;
    }
  };

  const calculatedEndDate = calculateEndDate();

  // Memoize options to prevent unnecessary re-renders
  const serviceOptions = useMemo(() => [
    { value: '', label: 'Select a service' },
    ...services.map(service => ({
      value: service.id,
      label: `${formatServiceTitleWithDuration(service.product_service, service.duration || '1 month')}${service.selling_price ? ` - $${service.selling_price}` : ''}`
    }))
  ], [services]);

  const clientOptions = useMemo(() => [
    { value: '', label: 'Select a client' },
    ...clients.map(client => ({
      value: client.id,
      label: `${client.name} (${client.email})`
    }))
  ], [clients]);

  // Fetch services and clients
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch services
        const { data: servicesData, error: servicesError } = await supabase
          .from('services')
          .select('id, product_service, logo_url, duration, cost, selling_price')
          .order('product_service');
        
        if (servicesError) throw servicesError;
        setServices(servicesData || []);

        // Fetch clients
        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select('id, name, email')
          .order('name');
        
        if (clientsError) throw clientsError;
        setClients(clientsData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  // Fetch pool information when editing
  useEffect(() => {
    const fetchPoolInfo = async () => {
      if (!editingSubscription?.resourcePoolId) {
        setResourcePool(null);
        setAssignedSeat(null);
        return;
      }

      try {
        // Fetch resource pool
        const { data: pool, error: poolError } = await getResourcePool(editingSubscription.resourcePoolId);
        if (poolError) throw poolError;
        setResourcePool(pool);

        // Fetch assigned seat if linked
        if (editingSubscription.resourcePoolSeatId) {
          const { data: seats, error: seatsError } = await getPoolSeats(editingSubscription.resourcePoolId);
          if (seatsError) throw seatsError;
          const seat = seats?.find(s => s.id === editingSubscription.resourcePoolSeatId);
          setAssignedSeat(seat || null);
        } else {
          setAssignedSeat(null);
        }
      } catch (error) {
        console.error('Error fetching pool info:', error);
        setResourcePool(null);
        setAssignedSeat(null);
      }
    };

    if (editingSubscription) {
      fetchPoolInfo();
    }
  }, [editingSubscription]);

  // Update selected service when serviceId changes
  useEffect(() => {
    if (formData.serviceId) {
      const service = services.find(s => s.id === formData.serviceId);
      setSelectedService(service || null);
      
      // Only auto-set interval days if strategy is EVERY_N_DAYS and service has duration
      if (service?.duration && formData.strategy === 'EVERY_N_DAYS') {
        const months = parseServiceDuration(service.duration);
        setFormData(prev => ({
          ...prev,
          intervalDays: months * 30 // Convert months to days
        }));
      }
    }
  }, [formData.serviceId, services, formData.strategy]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.serviceId) {
      newErrors.serviceId = 'Service is required';
    }
    if (!formData.clientId) {
      newErrors.clientId = 'Client is required';
    }
    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }
    if (!formData.strategy) {
      newErrors.strategy = 'Strategy is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    
    setIsLoading(true);
    try {
      let subscription: Subscription;
      
      if (saleId) {
        subscription = await subscriptionService.createFromSale(
          saleId,
          formData.serviceId,
          formData.clientId,
          {
            strategy: formData.strategy,
            intervalDays: formData.intervalDays,
            startedAt: formData.startDate,
            targetEndAt: calculatedEndDate ? new Date(calculatedEndDate).toISOString() : undefined,
            notes: formData.notes,
            isAutoRenew: formData.isAutoRenew
          }
        );
      } else {
        subscription = await subscriptionService.createManual(
          formData.serviceId,
          formData.clientId,
          {
            strategy: formData.strategy,
            intervalDays: formData.intervalDays,
            startedAt: formData.startDate,
            targetEndAt: calculatedEndDate ? new Date(calculatedEndDate).toISOString() : undefined,
            notes: formData.notes,
            isAutoRenew: formData.isAutoRenew
          }
        );
      }

      onSubscriptionCreated(subscription);
      setCreatedSubscriptionId(subscription.id);
      // Don't close immediately if we need to link resources
    } catch (error) {
      console.error('Error creating subscription:', error);
      alert('Failed to create subscription');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      serviceId: initialServiceId || '',
      clientId: initialClientId || '',
      startDate: new Date().toISOString().split('T')[0],
      strategy: 'MONTHLY',
      intervalDays: 30,
      isAutoRenew: true,
      notes: ''
    });
    setErrors({});
    setSelectedService(null);
    setCreatedSubscriptionId(null);
  };

  const handleResourceLinked = () => {
    resetForm();
    onClose();
  };

  const handleUnlinkPool = async () => {
    if (!editingSubscription?.resourcePoolId) return;
    
    if (!confirm('Are you sure you want to unlink this subscription from the resource pool? This will free up the assigned seat.')) {
      return;
    }

    try {
      setIsLoading(true);
      await unlinkSubscriptionFromPool(editingSubscription.id);
      
      // Update local state
      setResourcePool(null);
      setAssignedSeat(null);
      
      // Update the subscription in parent component
      if (onSubscriptionUpdated && editingSubscription) {
        const updatedSubscription = {
          ...editingSubscription,
          resourcePoolId: undefined,
          resourcePoolSeatId: undefined
        };
        onSubscriptionUpdated(updatedSubscription);
      }
    } catch (error) {
      console.error('Error unlinking pool:', error);
      alert('Failed to unlink resource pool');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchPool = () => {
    // This will show the LinkResourceSection for switching pools
    setCreatedSubscriptionId(editingSubscription?.id || '');
  };

  const fetchPoolInfo = async () => {
    if (!editingSubscription?.resourcePoolId) {
      setResourcePool(null);
      setAssignedSeat(null);
      return;
    }

    try {
      // Fetch resource pool
      const { data: pool, error: poolError } = await getResourcePool(editingSubscription.resourcePoolId);
      if (poolError) throw poolError;
      setResourcePool(pool);

      // Fetch assigned seat if linked
      if (editingSubscription.resourcePoolSeatId) {
        const { data: seats, error: seatsError } = await getPoolSeats(editingSubscription.resourcePoolId);
        if (seatsError) throw seatsError;
        const seat = seats?.find(s => s.id === editingSubscription.resourcePoolSeatId);
        setAssignedSeat(seat || null);
      } else {
        setAssignedSeat(null);
      }
    } catch (error) {
      console.error('Error fetching pool info:', error);
      setResourcePool(null);
      setAssignedSeat(null);
    }
  };

  const handleUpdateSubscription = async () => {
    if (!editingSubscription || !onSubscriptionUpdated) return;
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    try {
      const updatedSubscription = await subscriptionService.update(editingSubscription.id, {
        serviceId: formData.serviceId,
        clientId: formData.clientId,
        strategy: formData.strategy,
        intervalDays: formData.intervalDays,
        startedAt: formData.startDate,
        targetEndAt: calculatedEndDate ? new Date(calculatedEndDate).toISOString() : undefined,
        notes: formData.notes,
        isAutoRenew: formData.isAutoRenew
      });
      
      onSubscriptionUpdated(updatedSubscription);
      onClose();
    } catch (error) {
      console.error('Error updating subscription:', error);
      alert('Failed to update subscription');
    } finally {
      setIsLoading(false);
    }
  };

  const getServiceProvider = () => {
    if (!selectedService) return '';
    // Map service name to provider key
    const serviceName = selectedService.product_service.toLowerCase();
    const providerMap: Record<string, string> = {
      'adobe': 'adobe',
      'acrobat': 'acrobat',
      'apple one': 'apple_one',
      'canva': 'canva',
      'chatgpt': 'chatgpt',
      'duolingo': 'duolingo',
      'lastpass': 'lastpass',
      'microsoft 365': 'microsoft_365',
      'spotify': 'spotify',
    };
    
    for (const [key, provider] of Object.entries(providerMap)) {
      if (serviceName.includes(key)) {
        return provider;
      }
    }
    return '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">
            {isEditing ? 'Edit Subscription' : saleId ? 'Create Subscription from Sale' : 'Create New Subscription'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Service Selection */}
          <div>
            <SearchableDropdown
              label="Service"
              icon={<Package className="w-4 h-4" />}
              options={serviceOptions}
              value={formData.serviceId}
              onChange={(value) => handleInputChange('serviceId', value)}
              placeholder="Select a service"
              searchPlaceholder="Search services..."
              disabled={!!initialServiceId}
              error={errors.serviceId}
              showSearchThreshold={5}
            />
            {selectedService && selectedService.duration && (
              <p className="mt-1 text-sm text-blue-400">
                This service will create a {parseServiceDuration(selectedService.duration)}-month subscription
              </p>
            )}
          </div>

          {/* Client Selection */}
          <div>
            <SearchableDropdown
              label="Client"
              icon={<User className="w-4 h-4" />}
              options={clientOptions}
              value={formData.clientId}
              onChange={(value) => handleInputChange('clientId', value)}
              placeholder="Select a client"
              searchPlaceholder="Search clients..."
              disabled={!!initialClientId}
              error={errors.clientId}
              showSearchThreshold={5}
            />
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              When should this subscription begin?
            </label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => handleInputChange('startDate', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500"
            />
            {errors.startDate && (
              <p className="mt-1 text-sm text-red-400">{errors.startDate}</p>
            )}
          </div>

          {/* Calculated End Date */}
          {calculatedEndDate && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Subscription End Date
              </label>
              <div className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-green-400 font-medium">
                {new Date(calculatedEndDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
                             <p className="mt-1 text-sm text-gray-400">
                 Automatically calculated based on {selectedService?.duration ? parseServiceDuration(selectedService.duration) : 1}-month service duration
               </p>
            </div>
          )}

          {/* Strategy Selection */}
          <div>
            <SearchableDropdown
              label="Renewal Strategy"
              icon={<Clock className="w-4 h-4" />}
              options={[
                { value: 'MONTHLY', label: 'Monthly' },
                { value: 'EVERY_N_DAYS', label: 'Every N Days' }
              ]}
              value={formData.strategy}
              onChange={(value) => handleInputChange('strategy', value as RenewalStrategyKey)}
              placeholder="Select strategy"
              error={errors.strategy}
              showSearchThreshold={10}
            />
          </div>

          {/* Interval Days (for EVERY_N_DAYS strategy) */}
          {formData.strategy === 'EVERY_N_DAYS' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Clock className="w-4 h-4 inline mr-2" />
                Renewal Interval (days)
              </label>
              <input
                type="number"
                min="1"
                value={formData.intervalDays}
                onChange={(e) => handleInputChange('intervalDays', parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500"
              />
              <p className="mt-1 text-sm text-gray-400">
                How many days between renewals?
              </p>
                             {selectedService?.duration && formData.strategy === 'EVERY_N_DAYS' && (
                 <p className="mt-1 text-sm text-blue-400">
                   Suggested: {parseServiceDuration(selectedService.duration) * 30} days ({parseServiceDuration(selectedService.duration)} months) to match service duration
                 </p>
               )}
            </div>
          )}

          {/* Auto-renewal */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isAutoRenew"
              checked={formData.isAutoRenew}
              onChange={(e) => handleInputChange('isAutoRenew', e.target.checked)}
              className="w-4 h-4 text-green-600 bg-gray-800 border-gray-600 rounded focus:ring-green-500 focus:ring-2"
            />
            <label htmlFor="isAutoRenew" className="ml-2 text-sm text-gray-300">
              Auto-renewal enabled
            </label>
          </div>

          {/* Login */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Mail className="w-4 h-4 inline mr-2" />
              Login
            </label>
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500"
              placeholder="customer@example.com or customer@example.com:password"
            />
            <p className="mt-1 text-sm text-gray-400">
              Customer login for this subscription (used for seat assignment)
            </p>
          </div>

          {/* Resource Pool Information (when editing) */}
          {isEditing && resourcePool && (
            <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Archive className="w-4 h-4" />
                  Linked Resource Pool
                </h4>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSwitchPool}
                    disabled={isLoading}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded transition-colors"
                  >
                    <Edit className="w-3 h-3" />
                    Switch Pool
                  </button>
                  <button
                    type="button"
                    onClick={handleUnlinkPool}
                    disabled={isLoading}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                  >
                    <Unlink className="w-3 h-3" />
                    Unlink
                  </button>
                </div>
              </div>
              
              <div className="space-y-3">
                {/* Pool Info */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center text-lg">
                    {PROVIDER_ICONS[resourcePool.provider] || '📦'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">
                        {resourcePool.provider.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        resourcePool.status === 'active' ? 'bg-green-900/30 text-green-400' :
                        resourcePool.status === 'overdue' ? 'bg-amber-900/30 text-amber-400' :
                        'bg-red-900/30 text-red-400'
                      }`}>
                        {STATUS_LABELS[resourcePool.status] || resourcePool.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">
                      {POOL_TYPE_LABELS[resourcePool.pool_type] || resourcePool.pool_type} • 
                      {resourcePool.login_email}
                    </p>
                  </div>
                </div>

                {/* Seat Assignment */}
                {assignedSeat && (
                  <div className="mt-3 p-3 bg-gray-700/50 rounded-lg">
                    <h5 className="text-xs font-medium text-gray-300 mb-2">Assigned Seat</h5>
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium">
                        Seat #{assignedSeat.seat_index}
                      </span>
                      <span className="text-sm text-gray-400">
                        Assigned: {assignedSeat.assigned_at ? new Date(assignedSeat.assigned_at).toLocaleDateString() : 'Unknown'}
                      </span>
                    </div>
                    {assignedSeat.assigned_email && (
                      <p className="text-sm text-gray-400 mt-1">
                        Email: {assignedSeat.assigned_email}
                      </p>
                    )}
                  </div>
                )}

                {/* Pool Stats */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400">Seats:</span>
                    <span className="text-white">{resourcePool.used_seats}/{resourcePool.max_seats}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400">Expires:</span>
                    <span className="text-white">{new Date(resourcePool.end_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400">Status:</span>
                    <div className={`w-2 h-2 rounded-full ${
                      resourcePool.is_alive ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Resource Pool Linking */}
          {createdSubscriptionId && selectedService && (
            <LinkResourceSection
              serviceProvider={getServiceProvider()}
              subscriptionId={createdSubscriptionId}
              customerEmail={formData.notes}
              onResourceLinked={isEditing ? () => {
                // Refresh pool info after linking
                if (editingSubscription) {
                  fetchPoolInfo();
                }
                setCreatedSubscriptionId(null);
              } : handleResourceLinked}
            />
          )}

          {/* Info Section */}
          <div className="p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg text-blue-300 text-sm">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5" />
              <div>
                <p className="font-medium mb-1">How it works:</p>
                <ul className="space-y-1 text-xs">
                  <li>• <strong>Service Duration:</strong> End date automatically calculated from service duration</li>
                  <li>• <strong>Monthly:</strong> Renews every 30 days</li>
                  <li>• <strong>Every N Days:</strong> Custom interval between renewals</li>
                  <li>• <strong>Start Date:</strong> When the subscription begins</li>
                  <li>• <strong>Custom Renewal:</strong> Override next renewal date anytime</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handleUpdateSubscription}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors duration-200"
                >
                  {isLoading ? 'Updating...' : 'Update Subscription'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors duration-200"
                >
                  Cancel
                </button>
              </>
            ) : !createdSubscriptionId ? (
              <>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors duration-200"
                >
                  {isLoading ? 'Creating...' : 'Create Subscription'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors duration-200"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors duration-200"
              >
                Close
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
