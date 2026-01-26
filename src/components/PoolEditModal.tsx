import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Calendar, Users, Mail, Lock, FileText } from 'lucide-react';
import { ResourcePool } from '../types/inventory';
import { updateResourcePool } from '../lib/inventory';
import { SERVICE_PROVISIONING, POOL_TYPE_LABELS } from '../constants/provisioning';
import SearchableDropdown from './SearchableDropdown';
import { shouldIgnoreKeyboardEvent } from '../lib/useKeyboardShortcuts';

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
    max_seats: 1 as number | string,
    is_alive: true,
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Track if modal was previously open to avoid resetting on browser tab switch
  const wasOpen = useRef(false);
  const lastPoolId = useRef<string | null>(null);

  // Populate form when pool changes
  useEffect(() => {
    // Only initialize form when modal transitions from closed to open
    // Or when editing a different pool
    const isNewOpen = isOpen && !wasOpen.current;
    const isDifferentPool = pool?.id !== lastPoolId.current;

    if (isNewOpen || (isOpen && isDifferentPool)) {
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
        lastPoolId.current = pool.id;
      }
      setErrors({});
    }

    wasOpen.current = isOpen;
  }, [isOpen]);

  const validateForm = async () => {
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
    if (!formData.max_seats || formData.max_seats === '' || formData.max_seats < 1) {
      newErrors.max_seats = 'Number of seats must be at least 1';
    } else if (pool) {
      // Check if we're reducing seats below assigned seats
      const newSeatCount = typeof formData.max_seats === 'string' ? parseInt(formData.max_seats) : formData.max_seats;
      if (newSeatCount < pool.used_seats) {
        newErrors.max_seats = `Cannot reduce seats below ${pool.used_seats} (currently assigned seats)`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!(await validateForm()) || !pool) return;

    setLoading(true);
    try {
      // Check if is_alive is being changed from true to false
      const wasAlive = pool.is_alive;
      const willBeAlive = formData.is_alive;

      console.log(`Updating pool ${pool.id}, is_alive: ${wasAlive} -> ${willBeAlive}`);

      const { data, error } = await updateResourcePool(pool.id, {
        ...formData,
        max_seats: typeof formData.max_seats === 'string' ? parseInt(formData.max_seats) || 1 : formData.max_seats,
        start_at: new Date(formData.start_at).toISOString(),
        end_at: new Date(formData.end_at).toISOString(),
      });

      if (error) {
        console.error('Error updating pool:', error);
        alert(`Failed to update pool: ${error.message || 'Unknown error'}`);
        setLoading(false);
        return;
      }

      if (!data) {
        alert('Failed to update pool: No data returned');
        setLoading(false);
        return;
      }

      console.log('Pool updated successfully, received data:', data);

      // Verify the update was saved
      if (data.is_alive !== willBeAlive) {
        console.error('Update verification failed: is_alive mismatch', {
          expected: willBeAlive,
          actual: data.is_alive
        });
        alert('Warning: Pool update may not have been saved correctly. Please refresh the page.');
      }

      onPoolUpdated(data);
      onClose();
    } catch (error) {
      console.error('Error updating pool:', error);
      alert(`Failed to update pool: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  if (!isOpen || !pool) return null;

  const poolTypeOptions = Object.entries(POOL_TYPE_LABELS).map(([key, label]) => ({
    value: key,
    label
  }));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100]" style={{ top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', margin: 0, padding: '16px' }}>
      <div className="bg-card border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">Edit Pool</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-secondary/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Provider */}
          <div>
            <label className="block text-sm font-semibold text-muted-foreground mb-2">
              Provider
            </label>
            <input
              type="text"
              value={formData.provider}
              onChange={(e) => handleInputChange('provider', e.target.value)}
              className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white focus:ring-1 focus:ring-white/20 transition-colors opacity-50 cursor-not-allowed"
              disabled
            />
            <p className="mt-1 text-sm text-muted-foreground">Provider cannot be changed</p>
          </div>

          {/* Pool Type */}
          <div>
            <SearchableDropdown
              label="Pool Type"
              icon={<Users className="w-4 h-4" />}
              options={poolTypeOptions}
              value={formData.pool_type}
              onChange={(value) => handleInputChange('pool_type', value)}
              placeholder="Select pool type"
              searchPlaceholder="Search pool types..."
              showSearchThreshold={1}
            />
          </div>

          {/* Login Email */}
          <div>
            <label className="block text-sm font-semibold text-muted-foreground mb-2">
              <Mail className="w-4 h-4 inline mr-2" />
              Login Email *
            </label>
            <input
              type="email"
              value={formData.login_email}
              onChange={(e) => handleInputChange('login_email', e.target.value)}
              className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white focus:ring-1 focus:ring-white/20 transition-colors"
            />
            {errors.login_email && (
              <p className="mt-1 text-sm text-red-400">{errors.login_email}</p>
            )}
          </div>

          {/* Login Secret */}
          <div>
            <label className="block text-sm font-semibold text-muted-foreground mb-2">
              <Lock className="w-4 h-4 inline mr-2" />
              Login Secret
            </label>
            <input
              type="password"
              value={formData.login_secret}
              onChange={(e) => handleInputChange('login_secret', e.target.value)}
              className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white focus:ring-1 focus:ring-white/20 transition-colors"
              placeholder="Password or API key"
            />
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-semibold text-muted-foreground mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              Start Date *
            </label>
            <input
              type="date"
              value={formData.start_at}
              onChange={(e) => handleInputChange('start_at', e.target.value)}
              className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white focus:ring-1 focus:ring-white/20 transition-colors"
            />
            {errors.start_at && (
              <p className="mt-1 text-sm text-red-400">{errors.start_at}</p>
            )}
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-semibold text-muted-foreground mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              End Date *
            </label>
            <input
              type="date"
              value={formData.end_at}
              onChange={(e) => handleInputChange('end_at', e.target.value)}
              className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white focus:ring-1 focus:ring-white/20 transition-colors"
            />
            {errors.end_at && (
              <p className="mt-1 text-sm text-red-400">{errors.end_at}</p>
            )}
          </div>

          {/* Max Seats */}
          <div>
            <label className="block text-sm font-semibold text-muted-foreground mb-2">
              <Users className="w-4 h-4 inline mr-2" />
              Number of Seats *
            </label>
            <input
              type="number"
              min="1"
              value={formData.max_seats}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '') {
                  handleInputChange('max_seats', '');
                } else {
                  const numValue = parseInt(value);
                  if (!isNaN(numValue) && numValue >= 1) {
                    handleInputChange('max_seats', numValue);
                  }
                }
              }}
              className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white focus:ring-1 focus:ring-white/20 transition-colors"
            />
            {errors.max_seats && (
              <p className="mt-1 text-sm text-red-400">{errors.max_seats}</p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              Total number of seats in this pool (cannot be less than currently assigned seats)
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-muted-foreground mb-2">
              <FileText className="w-4 h-4 inline mr-2" />
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white focus:ring-1 focus:ring-white/20 transition-colors resize-none"
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
              className="w-4 h-4 text-white bg-secondary border-border rounded focus:ring-white/20"
            />
            <label htmlFor="is_alive" className="text-sm font-semibold text-muted-foreground">
              Pool is active and alive
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-6 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-secondary hover:bg-secondary/80 text-foreground font-semibold rounded-lg transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-white hover:bg-gray-100 disabled:bg-secondary text-black font-semibold rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
