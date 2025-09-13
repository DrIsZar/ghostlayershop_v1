import React, { useState, useEffect } from 'react';
import { X, Calendar, Mail, Lock, Users, FileText, Package } from 'lucide-react';
import { CreatePoolData, PoolType } from '../types/inventory';
import { createResourcePool } from '../lib/inventory';
import { SERVICE_PROVISIONING, PROVIDER_ICONS, POOL_TYPE_LABELS } from '../constants/provisioning';
import SearchableDropdown from './SearchableDropdown';
import { toast } from '../lib/toast';

interface PoolFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPoolCreated: (pool: any) => void;
}

export function PoolFormModal({ isOpen, onClose, onPoolCreated }: PoolFormModalProps) {
  const [formData, setFormData] = useState<CreatePoolData>({
    provider: '',
    pool_type: 'admin_console',
    login_email: '',
    login_secret: '',
    notes: '',
    start_at: new Date().toISOString().split('T')[0],
    end_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    max_seats: 1,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      
      setFormData({
        provider: '',
        pool_type: 'admin_console',
        login_email: '',
        login_secret: '',
        notes: '',
        start_at: startDate.toISOString().split('T')[0],
        end_at: endDate.toISOString().split('T')[0],
        max_seats: 1,
      });
      setErrors({});
    }
  }, [isOpen]);

  // Auto-fill defaults when provider changes
  useEffect(() => {
    if (formData.provider && SERVICE_PROVISIONING[formData.provider] && formData.start_at && formData.start_at.trim() !== '') {
      const config = SERVICE_PROVISIONING[formData.provider];
      const startDate = new Date(formData.start_at);
      
      // Check if the date is valid and config has valid values
      if (!isNaN(startDate.getTime()) && config && typeof config.defaultSeats === 'number' && !isNaN(config.defaultSeats)) {
        const endDate = new Date(startDate.getTime() + config.defaultDurationDays * 24 * 60 * 60 * 1000);
        
        setFormData(prev => ({
          ...prev,
          pool_type: config.poolType,
          max_seats: config.defaultSeats,
          end_at: endDate.toISOString().split('T')[0],
        }));
      }
    }
  }, [formData.provider, formData.start_at]);

  const handleInputChange = (field: keyof CreatePoolData, value: any) => {
    // Ensure max_seats is always a valid number
    if (field === 'max_seats') {
      const numValue = parseInt(value) || 1;
      setFormData(prev => ({ ...prev, [field]: numValue }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.provider) {
      newErrors.provider = 'Provider is required';
    }
    if (!formData.pool_type) {
      newErrors.pool_type = 'Pool type is required';
    }
    if (!formData.login_email) {
      newErrors.login_email = 'Login email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.login_email)) {
      newErrors.login_email = 'Please enter a valid email address';
    }
    if (!formData.start_at) {
      newErrors.start_at = 'Start date is required';
    } else if (isNaN(new Date(formData.start_at).getTime())) {
      newErrors.start_at = 'Please enter a valid start date';
    }
    if (!formData.end_at) {
      newErrors.end_at = 'End date is required';
    } else if (isNaN(new Date(formData.end_at).getTime())) {
      newErrors.end_at = 'Please enter a valid end date';
    } else if (new Date(formData.end_at) <= new Date(formData.start_at)) {
      newErrors.end_at = 'End date must be after start date';
    }
    if (!formData.max_seats || formData.max_seats < 1) {
      newErrors.max_seats = 'Max seats must be at least 1';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await createResourcePool(formData);
      if (error) throw error;
      
      toast.show('Pool created successfully', { type: 'success' });
      onPoolCreated(data);
      onClose();
    } catch (error) {
      console.error('Error creating pool:', error);
      toast.show('Failed to create pool', { type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const providerOptions = Object.keys(SERVICE_PROVISIONING).map(provider => ({
    value: provider,
    label: provider.charAt(0).toUpperCase() + provider.slice(1).replace('_', ' ')
  }));

  const poolTypeOptions = Object.entries(POOL_TYPE_LABELS).map(([key, label]) => ({
    value: key,
    label
  }));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100]" style={{ top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', margin: 0, padding: '16px' }}>
      <div 
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Create New Pool</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-700/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Provider Selection */}
          <div>
            <SearchableDropdown
              label="Provider"
              icon={<Package className="w-4 h-4" />}
              options={[
                { value: '', label: 'Select a provider' },
                ...providerOptions
              ]}
              value={formData.provider}
              onChange={(value) => handleInputChange('provider', value)}
              placeholder="Select a provider"
              searchPlaceholder="Search providers..."
              error={errors.provider}
              showSearchThreshold={5}
            />
            {formData.provider && SERVICE_PROVISIONING[formData.provider] && (
              <p className="mt-1 text-sm text-blue-400">
                Default: {SERVICE_PROVISIONING[formData.provider]?.defaultSeats} seats, {SERVICE_PROVISIONING[formData.provider]?.defaultDurationDays} days
              </p>
            )}
          </div>

          {/* Pool Type */}
          <div>
            <SearchableDropdown
              label="Pool Type"
              icon={<Users className="w-4 h-4" />}
              options={[
                { value: '', label: 'Select pool type' },
                ...poolTypeOptions
              ]}
              value={formData.pool_type}
              onChange={(value) => handleInputChange('pool_type', value as PoolType)}
              placeholder="Select pool type"
              error={errors.pool_type}
              showSearchThreshold={10}
            />
          </div>

          {/* Login Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              <Mail className="w-4 h-4 inline mr-2" />
              Login Email
            </label>
            <input
              type="email"
              value={formData.login_email}
              onChange={(e) => handleInputChange('login_email', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              placeholder="admin@example.com"
            />
            {errors.login_email && (
              <p className="mt-1 text-sm text-red-400">{errors.login_email}</p>
            )}
          </div>

          {/* Login Secret */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              <Lock className="w-4 h-4 inline mr-2" />
              Login Password/Secret
            </label>
            <input
              type="password"
              value={formData.login_secret}
              onChange={(e) => handleInputChange('login_secret', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              placeholder="Password or app-specific secret"
            />
            <p className="mt-1 text-sm text-gray-400">
              This will be stored securely and can be revealed in the UI
            </p>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              Start Date
            </label>
            <input
              type="date"
              value={formData.start_at}
              onChange={(e) => handleInputChange('start_at', e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              onFocus={(e) => e.stopPropagation()}
              onBlur={(e) => e.stopPropagation()}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
            {errors.start_at && (
              <p className="mt-1 text-sm text-red-400">{errors.start_at}</p>
            )}
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              End Date
            </label>
            <input
              type="date"
              value={formData.end_at}
              onChange={(e) => handleInputChange('end_at', e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              onFocus={(e) => e.stopPropagation()}
              onBlur={(e) => e.stopPropagation()}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
            {errors.end_at && (
              <p className="mt-1 text-sm text-red-400">{errors.end_at}</p>
            )}
          </div>

          {/* Max Seats */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              <Users className="w-4 h-4 inline mr-2" />
              Maximum Seats
            </label>
            <input
              type="number"
              min="1"
              value={isNaN(formData.max_seats) ? 1 : formData.max_seats}
              onChange={(e) => handleInputChange('max_seats', parseInt(e.target.value) || 1)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
            {errors.max_seats && (
              <p className="mt-1 text-sm text-red-400">{errors.max_seats}</p>
            )}
            <p className="mt-1 text-sm text-gray-400">
              Number of seats/licenses available in this pool
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              <FileText className="w-4 h-4 inline mr-2" />
              Notes (optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors resize-none"
              placeholder="Add any additional notes about this pool..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-6 border-t border-gray-700">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating...
                </>
              ) : (
                'Create Pool'
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
