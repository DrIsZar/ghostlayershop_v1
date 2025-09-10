import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, Users, Mail, Lock, FileText } from 'lucide-react';
import { ResourcePool } from '../types/inventory';
import { updateResourcePool } from '../lib/inventory';
import { SERVICE_PROVISIONING, POOL_TYPE_LABELS } from '../constants/provisioning';

interface PoolEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  pool: ResourcePool | null;
  onPoolUpdated: (pool: ResourcePool) => void;
}

export default function PoolEditModal({ 
  isOpen, 
  onClose, 
  pool, 
  onPoolUpdated 
}: PoolEditModalProps) {
  const [formData, setFormData] = useState({
    provider: '',
    pool_type: 'admin_console',
    login_email: '',
    login_secret: '',
    notes: '',
    start_at: '',
    end_at: '',
    max_seats: 1,
    is_alive: true,
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Populate form when pool changes
  useEffect(() => {
    if (pool) {
      setFormData({
        provider: pool.provider,
        pool_type: pool.pool_type,
        login_email: pool.login_email,
        login_secret: pool.login_secret || '',
        notes: pool.notes || '',
        start_at: pool.start_at.split('T')[0],
        end_at: pool.end_at.split('T')[0],
        max_seats: pool.max_seats,
        is_alive: pool.is_alive,
      });
    }
    setErrors({});
  }, [pool]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.provider) {
      newErrors.provider = 'Provider is required';
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
    
    if (!validateForm() || !pool) return;

    setLoading(true);
    try {
      const { data, error } = await updateResourcePool(pool.id, {
        ...formData,
        start_at: new Date(formData.start_at).toISOString(),
        end_at: new Date(formData.end_at).toISOString(),
      });
      
      if (error) throw error;
      
      onPoolUpdated(data);
      onClose();
    } catch (error) {
      console.error('Error updating pool:', error);
      alert('Failed to update pool');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (!isOpen || !pool) return null;

  const poolTypeOptions = Object.entries(POOL_TYPE_LABELS).map(([key, label]) => ({
    value: key,
    label
  }));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Edit Pool</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Provider */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Provider
            </label>
            <input
              type="text"
              value={formData.provider}
              onChange={(e) => handleInputChange('provider', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500"
              disabled
            />
            <p className="mt-1 text-sm text-gray-400">Provider cannot be changed</p>
          </div>

          {/* Pool Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Pool Type
            </label>
            <select
              value={formData.pool_type}
              onChange={(e) => handleInputChange('pool_type', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500"
            >
              {poolTypeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Login Email */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Mail className="w-4 h-4 inline mr-2" />
              Login Email *
            </label>
            <input
              type="email"
              value={formData.login_email}
              onChange={(e) => handleInputChange('login_email', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500"
            />
            {errors.login_email && (
              <p className="mt-1 text-sm text-red-400">{errors.login_email}</p>
            )}
          </div>

          {/* Login Secret */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Lock className="w-4 h-4 inline mr-2" />
              Login Secret
            </label>
            <input
              type="password"
              value={formData.login_secret}
              onChange={(e) => handleInputChange('login_secret', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500"
              placeholder="Password or API key"
            />
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              Start Date *
            </label>
            <input
              type="date"
              value={formData.start_at}
              onChange={(e) => handleInputChange('start_at', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500"
            />
            {errors.start_at && (
              <p className="mt-1 text-sm text-red-400">{errors.start_at}</p>
            )}
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              End Date *
            </label>
            <input
              type="date"
              value={formData.end_at}
              onChange={(e) => handleInputChange('end_at', e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500"
            />
            {errors.end_at && (
              <p className="mt-1 text-sm text-red-400">{errors.end_at}</p>
            )}
          </div>

          {/* Max Seats */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Users className="w-4 h-4 inline mr-2" />
              Maximum Seats *
            </label>
            <input
              type="number"
              min="1"
              value={isNaN(formData.max_seats) ? 1 : formData.max_seats}
              onChange={(e) => handleInputChange('max_seats', parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500"
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
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <FileText className="w-4 h-4 inline mr-2" />
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500"
              placeholder="Additional notes about this pool..."
            />
          </div>

          {/* Is Alive */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_alive"
              checked={formData.is_alive}
              onChange={(e) => handleInputChange('is_alive', e.target.checked)}
              className="w-4 h-4 text-green-600 bg-gray-800 border-gray-600 rounded focus:ring-green-500"
            />
            <label htmlFor="is_alive" className="text-sm font-medium text-gray-300">
              Pool is active and alive
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white font-medium rounded-lg transition-colors duration-200 flex items-center gap-2 ml-auto"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
