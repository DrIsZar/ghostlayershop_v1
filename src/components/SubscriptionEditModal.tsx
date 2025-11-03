import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Calendar, User, Package, Info, Clock, Mail, Archive, Edit, Unlink, Save, Trash2 } from 'lucide-react';
import { Subscription, RenewalStrategyKey } from '../types/subscription';
import { subscriptionService } from '../lib/subscriptionService';
import { supabase } from '../lib/supabase';
import { calculateEndDateFromDuration, formatServiceTitleWithDuration, parseServiceDuration } from '../lib/subscriptionUtils';
import SearchableDropdown from './SearchableDropdown';
import { LinkResourceSection } from './LinkResourceSection';
import { SERVICE_PROVISIONING } from '../constants/provisioning';
import { getResourcePool, getPoolSeats, unlinkSubscriptionFromPool, linkSubscriptionToPool, assignSeat } from '../lib/inventory';
import { ResourcePool, ResourcePoolSeat } from '../types/inventory';
import { PROVIDER_ICONS, POOL_TYPE_LABELS, STATUS_LABELS } from '../constants/provisioning';
import PoolEditModal from './PoolEditModal';

interface SubscriptionEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: Subscription | null;
  onUpdate: (subscription: Subscription) => void;
  onDelete: (subscriptionId: string) => void;
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

export default function SubscriptionEditModal({ 
  isOpen, 
  onClose, 
  subscription,
  onUpdate,
  onDelete
}: SubscriptionEditModalProps) {
  const [formData, setFormData] = useState({
    serviceId: '',
    clientId: '',
    startDate: '',
    strategy: 'MONTHLY' as RenewalStrategyKey,
    intervalDays: 30,
    notes: '',
    customNextRenewalAt: '',
    targetEndAt: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [resourcePool, setResourcePool] = useState<ResourcePool | null>(null);
  const [assignedSeat, setAssignedSeat] = useState<ResourcePoolSeat | null>(null);
  const [showResourceLinking, setShowResourceLinking] = useState(false);
  const [showPoolEditModal, setShowPoolEditModal] = useState(false);
  const [pendingPoolId, setPendingPoolId] = useState('');
  const [pendingSeatId, setPendingSeatId] = useState('');
  const linkResourceSectionRef = useRef<HTMLDivElement>(null);

  // Populate form data when subscription changes
  useEffect(() => {
    if (subscription && isOpen) {
      console.log('📝 Loading subscription for editing:', subscription.id);
      setFormData({
        serviceId: subscription.serviceId,
        clientId: subscription.clientId,
        startDate: subscription.startedAt ? subscription.startedAt.split('T')[0] : '',
        strategy: subscription.strategy,
        intervalDays: subscription.intervalDays || 30,
        notes: subscription.notes || '',
        customNextRenewalAt: subscription.customNextRenewalAt ? 
          subscription.customNextRenewalAt.split('T')[0] : '',
        targetEndAt: subscription.targetEndAt ? 
          subscription.targetEndAt.split('T')[0] : ''
      });
      fetchResourcePoolInfo();
      // Clear pending pool selection when modal opens
      setPendingPoolId('');
      setPendingSeatId('');
    }
  }, [subscription, isOpen]);

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
      if (!isOpen) return;
      
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

    fetchData();
  }, [isOpen]);

  // Update selected service when serviceId changes
  useEffect(() => {
    if (formData.serviceId) {
      const service = services.find(s => s.id === formData.serviceId);
      setSelectedService(service || null);
    }
  }, [formData.serviceId, services]);

  const fetchResourcePoolInfo = async () => {
    if (!subscription?.resourcePoolId) {
      setResourcePool(null);
      setAssignedSeat(null);
      return;
    }

    try {
      // Fetch resource pool
      const { data: pool, error: poolError } = await getResourcePool(subscription.resourcePoolId);
      if (poolError) throw poolError;
      setResourcePool(pool);

      // Fetch assigned seat if linked
      if (subscription.resourcePoolSeatId) {
        const { data: seats, error: seatsError } = await getPoolSeats(subscription.resourcePoolId);
        if (seatsError) throw seatsError;
        const seat = seats?.find(s => s.id === subscription.resourcePoolSeatId);
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

  const handleSave = async () => {
    if (!subscription) return;
    
    if (!validateForm()) return;
    
    console.log('🔄 Updating subscription:', subscription.id, 'with data:', formData);
    setIsLoading(true);
    try {
      // Prepare the update data
      const updateData: Partial<Subscription> = {
        serviceId: formData.serviceId,
        clientId: formData.clientId,
        strategy: formData.strategy,
        intervalDays: formData.intervalDays,
        startedAt: formData.startDate,
        targetEndAt: formData.targetEndAt ? new Date(formData.targetEndAt).toISOString() : undefined,
        notes: formData.notes
      };

      let updated: Subscription;

      // Handle custom renewal date separately
      if (formData.customNextRenewalAt && formData.customNextRenewalAt !== subscription.customNextRenewalAt?.split('T')[0]) {
        updated = await subscriptionService.setCustomRenewalDate(subscription.id, formData.customNextRenewalAt);
        // Also update other fields
        if (Object.keys(updateData).some(key => updateData[key as keyof typeof updateData] !== undefined)) {
          updated = await subscriptionService.updateSubscription(subscription.id, updateData);
        }
      } else if (formData.customNextRenewalAt === '' && subscription.customNextRenewalAt) {
        // If custom date is being cleared, use the clear method
        updated = await subscriptionService.clearCustomRenewalDate(subscription.id);
        // Also update other fields
        if (Object.keys(updateData).some(key => updateData[key as keyof typeof updateData] !== undefined)) {
          updated = await subscriptionService.updateSubscription(subscription.id, updateData);
        }
      } else {
        // Otherwise use regular update
        updated = await subscriptionService.updateSubscription(subscription.id, updateData);
      }
      
      console.log('✅ Subscription updated successfully:', updated);
      
      // Check if there's a pending pool selection and link it
      if (pendingPoolId) {
        console.log('🔗 Pending pool detected, performing linking...');
        await performPoolLinking(
          pendingPoolId, 
          pendingSeatId, 
          subscription.id, 
          formData.notes || `customer-${subscription.id.slice(0, 8)}`
        );
        console.log('✅ Pool linked successfully');
        
        // Refresh subscription to get updated pool info
        const refreshedSub = await subscriptionService.getSubscription(subscription.id);
        onUpdate(refreshedSub);
      } else {
        onUpdate(updated);
      }
      
      onClose();
    } catch (error) {
      console.error('❌ Error updating subscription:', error);
      alert('Failed to update subscription: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!subscription) return;

    if (!confirm('Delete this subscription? This action cannot be undone and will remove all subscription history.')) return;

    console.log('Starting subscription deletion process:', subscription.id);
    setIsLoading(true);
    try {
      // Call the service to delete the subscription
      await subscriptionService.delete(subscription.id);
      console.log('Subscription service delete completed for:', subscription.id);
      
      // Notify parent component
      onDelete(subscription.id);
      console.log('Parent component notified of deletion:', subscription.id);
      
      // Close the modal
      onClose();
    } catch (error) {
      console.error('Error deleting subscription:', subscription.id, error);
      alert(`Failed to delete subscription: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlinkPool = async () => {
    if (!subscription?.resourcePoolId) return;
    
    const poolInfo = resourcePool ? `${resourcePool.provider.replace('_', ' ').toUpperCase()} (${resourcePool.login_email})` : 'the resource pool';
    const seatInfo = assignedSeat ? ` and free up seat #${assignedSeat.seat_index}` : '';
    
    if (!confirm(`Are you sure you want to unlink this subscription from ${poolInfo}?${seatInfo}\n\nThis action will:\n• Remove the pool assignment from this subscription\n• Free up the assigned seat for other subscriptions\n• Cannot be undone automatically`)) {
      return;
    }

    try {
      setIsLoading(true);
      await unlinkSubscriptionFromPool(subscription.id);
      
      // Update local state
      setResourcePool(null);
      setAssignedSeat(null);
      
      // Update the subscription in parent component
      if (subscription) {
        const updatedSubscription = {
          ...subscription,
          resourcePoolId: undefined,
          resourcePoolSeatId: undefined
        };
        onUpdate(updatedSubscription);
      }
    } catch (error) {
      console.error('Error unlinking pool:', error);
      alert('Failed to unlink resource pool');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to perform actual pool linking
  const performPoolLinking = async (poolId: string, seatId: string, subscriptionId: string, customerEmail: string) => {
    console.log('Performing pool linking:', { poolId, seatId, subscriptionId, customerEmail });
    
    let result;
    if (seatId) {
      // Assign specific seat first, then link
      console.log('Assigning specific seat:', seatId);
      const { data: seatData, error: assignError } = await assignSeat(seatId, {
        email: customerEmail || undefined,
        subscriptionId: subscriptionId,
      });
      
      if (assignError) {
        console.error('Specific seat assignment error:', assignError);
        throw new Error(`Seat assignment failed: ${assignError.message || 'Unknown error'}`);
      }
      
      console.log('Assigned specific seat:', seatData?.id);
      result = await linkSubscriptionToPool(subscriptionId, poolId, seatData?.id);
    } else {
      // Auto-assign next available seat
      console.log('Auto-assigning next available seat in pool:', poolId);
      result = await linkSubscriptionToPool(subscriptionId, poolId, undefined, {
        email: customerEmail || undefined,
        subscriptionId: subscriptionId,
      });
    }
    
    const { error } = result;
    
    if (error) {
      console.error('Subscription linking error:', error);
      throw new Error(`Failed to link subscription to pool: ${error.message || 'Unknown error'}`);
    }
    
    console.log('Successfully linked resource pool');
    return result;
  };

  const handlePoolSelectionChange = (poolId: string, seatId: string) => {
    console.log('Pool selection changed:', { poolId, seatId });
    setPendingPoolId(poolId);
    setPendingSeatId(seatId);
  };

  const handleResourceLinked = async () => {
    console.log('Resource linked, refreshing and closing modals');
    // Refresh resource pool info after linking
    await fetchResourcePoolInfo();
    setShowResourceLinking(false);
    setPendingPoolId('');
    setPendingSeatId('');
    // Refresh the subscription to ensure parent component has latest data
    if (subscription) {
      const refreshedSub = await subscriptionService.getSubscription(subscription.id);
      onUpdate(refreshedSub);
    }
    // Close all modals as requested by user
    onClose();
  };

  const handleLinkAndSave = async () => {
    if (!subscription || !pendingPoolId) return;
    
    console.log('Link and Save triggered');
    setIsLoading(true);
    
    try {
      // First, save subscription changes
      if (!validateForm()) {
        setIsLoading(false);
        return;
      }
      
      const updateData: Partial<Subscription> = {
        serviceId: formData.serviceId,
        clientId: formData.clientId,
        strategy: formData.strategy,
        intervalDays: formData.intervalDays,
        startedAt: formData.startDate,
        targetEndAt: formData.targetEndAt ? new Date(formData.targetEndAt).toISOString() : undefined,
        notes: formData.notes
      };

      let updated: Subscription;

      // Handle custom renewal date separately
      if (formData.customNextRenewalAt && formData.customNextRenewalAt !== subscription.customNextRenewalAt?.split('T')[0]) {
        updated = await subscriptionService.setCustomRenewalDate(subscription.id, formData.customNextRenewalAt);
        if (Object.keys(updateData).some(key => updateData[key as keyof typeof updateData] !== undefined)) {
          updated = await subscriptionService.updateSubscription(subscription.id, updateData);
        }
      } else if (formData.customNextRenewalAt === '' && subscription.customNextRenewalAt) {
        updated = await subscriptionService.clearCustomRenewalDate(subscription.id);
        if (Object.keys(updateData).some(key => updateData[key as keyof typeof updateData] !== undefined)) {
          updated = await subscriptionService.updateSubscription(subscription.id, updateData);
        }
      } else {
        updated = await subscriptionService.updateSubscription(subscription.id, updateData);
      }
      
      console.log('✅ Subscription updated successfully:', updated);
      
      // Now perform pool linking
      await performPoolLinking(
        pendingPoolId, 
        pendingSeatId, 
        subscription.id, 
        formData.notes || `customer-${subscription.id.slice(0, 8)}`
      );
      
      console.log('✅ Pool linked successfully');
      
      // Refresh subscription data
      const refreshedSub = await subscriptionService.getSubscription(subscription.id);
      onUpdate(refreshedSub);
      
      // Close all modals
      onClose();
    } catch (error) {
      console.error('❌ Error in link and save:', error);
      alert('Failed to save changes and link pool: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePoolUpdated = async (updatedPool: ResourcePool) => {
    console.log('Pool updated in subscription edit modal:', updatedPool);
    // Update local pool state
    setResourcePool(updatedPool);
    // Close the pool edit modal
    setShowPoolEditModal(false);
    // Refresh pool info to get latest data
    await fetchResourcePoolInfo();
    // Refresh the subscription to ensure parent component has latest data
    if (subscription) {
      const refreshedSub = await subscriptionService.getSubscription(subscription.id);
      onUpdate(refreshedSub);
    }
    // Close all modals as requested by user
    onClose();
  };

  const handleSwitchPool = () => {
    setShowResourceLinking(true);
    // Scroll to the Link Resource Pool section after a short delay to ensure it's rendered
    setTimeout(() => {
      if (linkResourceSectionRef.current) {
        linkResourceSectionRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    }, 100);
  };

  const getServiceProvider = () => {
    if (!selectedService) return '';
    // Map service name to provider key
    const serviceName = selectedService.product_service.toLowerCase();
    const providerMap: Record<string, string> = {
      'adobe': 'adobe',
      'acrobat': 'acrobat',
      'apple one': 'apple_one',
      'apple music': 'apple_music',
      'canva': 'canva',
      'chatgpt': 'chatgpt',
      'duolingo': 'duolingo',
      'icloud': 'icloud',
      'lastpass': 'lastpass',
      'microsoft 365': 'microsoft_365',
      'netflix': 'netflix',
      'spotify': 'spotify',
      'workspace': 'workspace',
      'google workspace': 'google_workspace',
    };
    
    for (const [key, provider] of Object.entries(providerMap)) {
      if (serviceName.includes(key)) {
        return provider;
      }
    }
    return '';
  };

  if (!isOpen || !subscription) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100]" style={{ top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', margin: 0, padding: '16px' }}>
      <div 
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-subscription-title"
      >
        {/* Header - Fixed */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700 flex-shrink-0">
          <h2 id="edit-subscription-title" className="text-xl font-semibold text-white">
            Edit Subscription
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-700/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
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
              error={errors.serviceId}
              showSearchThreshold={5}
            />
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
              error={errors.clientId}
              showSearchThreshold={5}
            />
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              Start Date
            </label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => handleInputChange('startDate', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
            {errors.startDate && (
              <p className="mt-1 text-sm text-red-400">{errors.startDate}</p>
            )}
          </div>

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
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                <Clock className="w-4 h-4 inline mr-2" />
                Renewal Interval (days)
              </label>
              <input
                type="number"
                min="1"
                value={formData.intervalDays}
                onChange={(e) => handleInputChange('intervalDays', parseInt(e.target.value))}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                placeholder="30"
              />
            </div>
          )}

          {/* Target End Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              Target End Date
            </label>
            <input
              type="date"
              value={formData.targetEndAt}
              onChange={(e) => handleInputChange('targetEndAt', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
            <p className="mt-1 text-xs text-gray-400">
              Optional end date for the subscription
            </p>
          </div>

          {/* Custom Next Renewal Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              Custom Next Renewal Date
            </label>
            <input
              type="date"
              value={formData.customNextRenewalAt}
              onChange={(e) => handleInputChange('customNextRenewalAt', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
            <p className="mt-1 text-xs text-gray-400">
              Set a custom renewal date or leave empty to use automatic renewal
            </p>
          </div>

          {/* Login */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              <Mail className="w-4 h-4 inline mr-2" />
              Login Email
            </label>
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              placeholder="customer@example.com or customer@example.com:password"
            />
            <p className="mt-1 text-xs text-gray-400">
              Customer login for this subscription (used for seat assignment)
            </p>
          </div>

          {/* Resource Pool Information */}
          {resourcePool && (
              <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Archive className="w-4 h-4" />
                  Linked Resource Pool
                </h4>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPoolEditModal(true)}
                    disabled={isLoading}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-green-400 hover:text-green-300 hover:bg-green-900/20 rounded transition-colors"
                  >
                    <Edit className="w-3 h-3" />
                    Edit Pool
                  </button>
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
          {showResourceLinking && subscription && selectedService && (
            <div 
              ref={linkResourceSectionRef}
              className="border-2 border-blue-500 rounded-xl p-1 -m-1 animate-pulse"
            >
              <LinkResourceSection
                serviceProvider={getServiceProvider()}
                subscriptionId={subscription.id}
                customerEmail={formData.notes || `customer-${subscription.id.slice(0, 8)}`}
                onResourceLinked={handleResourceLinked}
                onPoolSelectionChange={handlePoolSelectionChange}
                onLinkAndSave={handleLinkAndSave}
              />
            </div>
          )}

          {/* Link Resource Pool Button (if no pool linked) */}
          {!resourcePool && !showResourceLinking && selectedService && (
            <div className="p-4 bg-blue-900/30 border border-blue-700/50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-300 font-medium">Resource Pool Linking</p>
                  <p className="text-xs text-blue-200 mt-1">
                    Link this subscription to a resource pool for seat management
                  </p>
                </div>
                <button
                  onClick={handleSwitchPool}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                >
                  Link Pool
                </button>
              </div>
            </div>
          )}

          </div>
        </div>

        {/* Actions - Fixed Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-700 flex-shrink-0 bg-gray-900">
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
          <button
            onClick={handleDelete}
            disabled={isLoading}
            className="px-4 py-3 bg-red-800 hover:bg-red-900 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors duration-200"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Pool Edit Modal */}
      {resourcePool && (
        <PoolEditModal
          isOpen={showPoolEditModal}
          onClose={() => setShowPoolEditModal(false)}
          pool={resourcePool}
          onPoolUpdated={handlePoolUpdated}
        />
      )}
    </div>
  );
}
