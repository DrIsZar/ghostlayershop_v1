import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Trash2 } from 'lucide-react';
import { Service, categories, ServiceType } from '../lib/supabase';
import { uploadServiceLogo, validateLogoFile } from '../lib/fileUtils';
import SearchableDropdown from './SearchableDropdown';
import { shouldIgnoreKeyboardEvent } from '../lib/useKeyboardShortcuts';
import { useCurrency } from '../lib/currency';

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (service: Omit<Service, 'id' | 'created_at' | 'updated_at'>) => void;
  service?: Service | null;
  onLogoChange?: () => void; // Callback for logo changes
}

export default function ServiceModal({ isOpen, onClose, onSave, service, onLogoChange }: ServiceModalProps) {
  const { formatCurrency, currency } = useCurrency();
  const [formData, setFormData] = useState({
    product_service: '',
    category: 'Software',
    duration: '',
    info_needed: '',
    cost: 0,
    selling_price: 0,
    logo_url: '',
    service_type: 'family_invite' as ServiceType
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoInputType, setLogoInputType] = useState<'file' | 'url'>('file');
  const [logoUrlInput, setLogoUrlInput] = useState('');

  // Track if modal was previously open to avoid resetting on browser tab switch
  const wasOpen = useRef(false);
  const lastServiceId = useRef<string | null>(null);

  useEffect(() => {
    // Only initialize form when modal transitions from closed to open
    // Or when editing a different service
    const isNewOpen = isOpen && !wasOpen.current;
    const isDifferentService = service?.id !== lastServiceId.current;

    if (isNewOpen || (isOpen && isDifferentService)) {
      if (service) {
        setFormData({
          product_service: service.product_service,
          category: service.category,
          duration: service.duration,
          info_needed: service.info_needed,
          cost: service.cost,
          selling_price: service.selling_price,
          logo_url: service.logo_url || '',
          service_type: service.service_type || 'family_invite'
        });
        setLogoPreview(service.logo_url || '');
        setLogoUrlInput(service.logo_url || '');
        setLogoFile(null);
        // Set input type based on existing logo
        setLogoInputType(service.logo_url ? 'url' : 'file');
        lastServiceId.current = service.id;
      } else {
        setFormData({
          product_service: '',
          category: 'Software',
          duration: '',
          info_needed: '',
          cost: 0,
          selling_price: 0,
          logo_url: '',
          service_type: 'family_invite' as ServiceType
        });
        setLogoPreview('');
        setLogoFile(null);
        setLogoUrlInput('');
        setLogoInputType('file');
        lastServiceId.current = null;
      }
    }

    wasOpen.current = isOpen;
  }, [isOpen]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (validateLogoFile(file)) {
        setLogoFile(file);
        setLogoUrlInput(''); // Clear URL input when file is selected
        const reader = new FileReader();
        reader.onload = () => {
          setLogoPreview(reader.result as string);
          // Notify parent of logo change
          onLogoChange?.();
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleLogoUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setLogoUrlInput(url);

    if (url.trim()) {
      // Clear any existing file upload
      setLogoFile(null);
      // Update the form data with the new URL
      setFormData({ ...formData, logo_url: url.trim() });
      // Set new preview immediately
      setLogoPreview(url.trim());
      // Notify parent of logo change
      onLogoChange?.();
    } else {
      // If URL is empty, clear everything
      setLogoPreview('');
      setFormData({ ...formData, logo_url: '' });
      // Notify parent of logo change
      onLogoChange?.();
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview('');
    setLogoUrlInput('');
    setFormData({ ...formData, logo_url: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // Remove logo from localStorage for immediate UI updates
    if (formData.product_service) {
      const logoKey = `service_logo_${formData.product_service.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      localStorage.removeItem(logoKey);
    }

    // Dispatch custom event for immediate UI update
    window.dispatchEvent(new CustomEvent('logoUpdated'));

    // Notify parent of logo change
    onLogoChange?.();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsUploading(true);
      let finalLogoUrl = '';

      // Handle logo based on input type
      if (logoInputType === 'file' && logoFile) {
        // Upload new logo file
        const uploadedFile = await uploadServiceLogo(logoFile, formData.product_service);
        finalLogoUrl = uploadedFile.url;

        // Dispatch custom event for immediate UI update
        window.dispatchEvent(new CustomEvent('logoUpdated'));
      } else if (logoInputType === 'url' && logoUrlInput.trim()) {
        // Use provided URL and store it in localStorage for immediate UI updates
        finalLogoUrl = logoUrlInput.trim();

        // Store URL-based logo in localStorage for immediate UI updates
        const logoKey = `service_logo_${formData.product_service.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        const urlBasedLogo = {
          name: 'URL Logo',
          url: finalLogoUrl,
          size: 0,
          type: 'image/url',
          timestamp: Date.now()
        };
        localStorage.setItem(logoKey, JSON.stringify(urlBasedLogo));

        // Dispatch custom event for immediate UI update
        window.dispatchEvent(new CustomEvent('logoUpdated'));
      } else if (formData.logo_url) {
        // Keep existing logo if no new input
        finalLogoUrl = formData.logo_url;
      }

      // Prepare service data with logo
      const serviceData = {
        ...formData,
        logo_url: finalLogoUrl
      };

      onSave(serviceData);
      onClose();
    } catch (error) {
      console.error('Error handling logo:', error);
      alert('Error handling logo. Please try again.');
    } finally {
      setIsUploading(false);
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

      if (event.key === 'Enter' && !isUploading) {
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
  }, [isOpen, isUploading, onClose]);

  if (!isOpen) return null;

  const profit = formData.selling_price - formData.cost;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100]" style={{ top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', margin: 0, padding: '16px' }}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">
            {service ? 'Edit Service' : 'Add New Service'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-700/50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Logo Upload Section - Enhanced styling */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3">Service Logo</label>
            <div className="space-y-3">
              {/* Logo Preview - Improved styling */}
              {logoPreview && (
                <div className="relative inline-block">
                  <div className="w-24 h-24 rounded-xl overflow-hidden bg-gray-700 border-2 border-gray-600 shadow-lg">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="absolute -top-1 -right-1 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors shadow-lg hover:scale-110 z-10"
                    title="Remove logo"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Input Type Toggle */}
              <div className="flex items-center gap-2 p-1 bg-gray-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setLogoInputType('file')}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200 ${logoInputType === 'file'
                    ? 'bg-white text-black shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setLogoInputType('url')}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200 ${logoInputType === 'url'
                    ? 'bg-white text-black shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                >
                  Use URL
                </button>
              </div>

              {/* File Upload Input */}
              {logoInputType === 'file' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="hidden"
                      id="logo-upload"
                    />
                    <label
                      htmlFor="logo-upload"
                      className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 text-white rounded-lg cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105"
                    >
                      <Upload className="h-4 w-4" />
                      {logoFile ? 'Change Logo' : 'Upload Logo'}
                    </label>
                    {logoFile && (
                      <span className="text-sm text-gray-400 bg-gray-800/50 px-3 py-1.5 rounded border border-gray-600">
                        {logoFile.name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 bg-gray-800/30 px-3 py-2 rounded border border-gray-700">
                    <strong>Supported formats:</strong> JPEG, PNG, GIF, WebP (max 5MB)
                  </p>
                </div>
              )}

              {/* URL Input */}
              {logoInputType === 'url' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="url"
                      value={logoUrlInput}
                      onChange={handleLogoUrlChange}
                      placeholder="https://example.com/logo.png"
                      className="ghost-input flex-1"
                    />
                    {logoUrlInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setLogoUrlInput('');
                          setLogoPreview('');
                        }}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all duration-200"
                        title="Clear URL"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 bg-gray-800/30 px-3 py-2 rounded border border-gray-700">
                    <strong>Enter a direct image URL:</strong> Must be a valid image file (JPEG, PNG, GIF, WebP)
                  </p>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Product/Service</label>
            <input
              type="text"
              value={formData.product_service}
              onChange={(e) => setFormData({ ...formData, product_service: e.target.value })}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-white focus:ring-1 focus:ring-white/30 transition-colors"
              placeholder="Enter service name"
              required
            />
          </div>

          <div>
            <SearchableDropdown
              label="Category"
              options={categories.sort().map(category => ({
                value: category,
                label: category
              }))}
              value={formData.category}
              onChange={(value) => setFormData({ ...formData, category: value })}
              placeholder="Select category"
              searchPlaceholder="Search categories..."
              showSearchThreshold={5}
            />
          </div>

          <div>
            <SearchableDropdown
              label="Service Type"
              options={[
                { value: 'family_invite', label: 'Family/Invite (Pools)' },
                { value: 'personal_upgrade', label: 'Personal Upgrade (Personal Accounts)' }
              ]}
              value={formData.service_type}
              onChange={(value) => setFormData({ ...formData, service_type: value as ServiceType })}
              placeholder="Select service type"
              allowClear={false}
            />
            <p className="mt-1 text-xs text-gray-500">
              Family/Invite services appear in Pools. Personal Upgrade services appear in Personal Accounts.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Duration</label>
            <input
              type="text"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-white focus:ring-1 focus:ring-white/30 transition-colors"
              placeholder="e.g. 1 month, 12 months"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Info Needed</label>
            <input
              type="text"
              value={formData.info_needed}
              onChange={(e) => setFormData({ ...formData, info_needed: e.target.value })}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-white focus:ring-1 focus:ring-white/30 transition-colors"
              placeholder="e.g. Email, Email+Password"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Cost ({currency})</label>
              <input
                type="number"
                step="0.01"
                value={formData.cost}
                onChange={(e) => {
                  const value = e.target.value;
                  const parsedValue = value === '' ? 0 : parseFloat(value);
                  if (parsedValue >= 0) {
                    setFormData({ ...formData, cost: parsedValue });
                  }
                }}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-white focus:ring-1 focus:ring-white/30 transition-colors"
                placeholder="0.00"
                required
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Selling Price ({currency})</label>
              <input
                type="number"
                step="0.01"
                value={formData.selling_price}
                onChange={(e) => {
                  const value = e.target.value;
                  const parsedValue = value === '' ? 0 : parseFloat(value);
                  if (parsedValue >= 0) {
                    setFormData({ ...formData, selling_price: parsedValue });
                  }
                }}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-white focus:ring-1 focus:ring-white/30 transition-colors"
                placeholder="0.00"
                required
                min="0"
              />
            </div>
          </div>

          <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
            <div className="text-sm font-medium text-gray-300 mb-1">Profit Preview:</div>
            <div className={`text-2xl font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(profit)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {profit >= 0 ? 'Positive profit margin' : 'Negative profit - adjust pricing'}
            </div>
          </div>

          <div className="flex gap-3 pt-6 border-t border-gray-700">
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-white hover:bg-gray-100 text-black font-semibold rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  {service ? 'Updating...' : 'Adding...'}
                </>
              ) : (
                <>
                  {service ? 'Update Service' : 'Add Service'}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors duration-200"
              disabled={isUploading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}