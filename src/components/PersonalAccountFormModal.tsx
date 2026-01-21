import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { CreatePersonalAccountData, PersonalAccount } from '../types/inventory';
import { createPersonalAccount, updatePersonalAccount } from '../lib/inventory';
import { toast } from '../lib/toast';
import SearchableDropdown from './SearchableDropdown';
import { formatDateForInput } from '../lib/dateUtils';
import { getProvidersByServiceType } from '../lib/fileUtils';

interface PersonalAccountFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountCreated?: (account: PersonalAccount) => void;
  onAccountUpdated?: (account: PersonalAccount) => void;
  account?: PersonalAccount | null;
}

export function PersonalAccountFormModal({
  isOpen,
  onClose,
  onAccountCreated,
  onAccountUpdated,
  account
}: PersonalAccountFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreatePersonalAccountData>({
    provider: '',
    login_email: '',
    login_secret: '',
    notes: '',
    expiry_date: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [providers, setProviders] = useState<string[]>([]);

  // Track if modal was previously open to avoid resetting on browser tab switch
  const wasOpen = useRef(false);

  useEffect(() => {
    // Only initialize form when modal transitions from closed to open
    // Not when component re-renders while modal is already open (e.g., browser tab switch)
    if (isOpen && !wasOpen.current) {
      if (account) {
        setFormData({
          provider: account.provider,
          login_email: account.login_email,
          login_secret: account.login_secret || '',
          notes: account.notes || '',
          expiry_date: account.expiry_date ? formatDateForInput(new Date(account.expiry_date)) : '',
        });
      } else {
        setFormData({
          provider: '',
          login_email: '',
          login_secret: '',
          notes: '',
          expiry_date: '',
        });
      }
      setErrors({});

      // Fetch providers for personal upgrades
      getProvidersByServiceType('personal_upgrade').then(setProviders);
    }

    wasOpen.current = isOpen;
  }, [account, isOpen]);

  const handleInputChange = (field: keyof CreatePersonalAccountData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.provider.trim()) {
      newErrors.provider = 'Provider is required';
    }

    if (!formData.login_email.trim()) {
      newErrors.login_email = 'Login email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.login_email)) {
      newErrors.login_email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const data = {
        ...formData,
        expiry_date: formData.expiry_date || undefined,
        login_secret: formData.login_secret || undefined,
        notes: formData.notes || undefined,
      };

      if (account) {
        const { data: updated, error } = await updatePersonalAccount(account.id, data);
        if (error) throw error;
        if (updated && onAccountUpdated) {
          onAccountUpdated(updated);
        }
        toast.show('Account updated successfully', { type: 'success' });
      } else {
        const { data: created, error } = await createPersonalAccount(data);
        if (error) throw error;
        if (created && onAccountCreated) {
          onAccountCreated(created);
        }
        toast.show('Account created successfully', { type: 'success' });
      }
      onClose();
    } catch (error: any) {
      console.error('Error saving account:', error);
      toast.show(error.message || 'Failed to save account', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">
            {account ? 'Edit Personal Account' : 'Add Personal Account'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-700/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Service Provider *
            </label>
            <SearchableDropdown
              options={[
                { value: '', label: 'Select a provider' },
                ...providers.map(provider => ({
                  value: provider,
                  label: provider.charAt(0).toUpperCase() + provider.slice(1).replace('_', ' ')
                }))
              ]}
              value={formData.provider}
              onChange={(value) => handleInputChange('provider', value)}
              placeholder="Select a provider"
              className="w-full"
              allowClear={false}
            />
            {errors.provider && (
              <p className="mt-1 text-sm text-red-400">{errors.provider}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Login Email *
            </label>
            <input
              type="email"
              value={formData.login_email}
              onChange={(e) => handleInputChange('login_email', e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-white"
              required
            />
            {errors.login_email && (
              <p className="mt-1 text-sm text-red-400">{errors.login_email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Login Secret/Password
            </label>
            <input
              type="password"
              value={formData.login_secret}
              onChange={(e) => handleInputChange('login_secret', e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Expiry Date
            </label>
            <input
              type="date"
              value={formData.expiry_date}
              onChange={(e) => handleInputChange('expiry_date', e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-white"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-white hover:bg-gray-100 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : account ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

