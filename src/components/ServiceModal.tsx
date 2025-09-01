import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Image, Trash2 } from 'lucide-react';
import { Service, categories } from '../lib/supabase';
import { uploadServiceLogo, validateLogoFile, removeServiceLogo } from '../lib/fileUtils';

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (service: Omit<Service, 'id' | 'created_at' | 'updated_at'>) => void;
  service?: Service | null;
}

export default function ServiceModal({ isOpen, onClose, onSave, service }: ServiceModalProps) {
  const [formData, setFormData] = useState({
    product_service: '',
    category: 'Software',
    duration: '',
    info_needed: '',
    cost: 0,
    selling_price: 0,
    logo_url: ''
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoInputType, setLogoInputType] = useState<'file' | 'url'>('file');
  const [logoUrlInput, setLogoUrlInput] = useState('');

  useEffect(() => {
    if (service) {
      setFormData({
        product_service: service.product_service,
        category: service.category,
        duration: service.duration,
        info_needed: service.info_needed,
        cost: service.cost,
        selling_price: service.selling_price,
        logo_url: service.logo_url || ''
      });
      setLogoPreview(service.logo_url || '');
      setLogoUrlInput(service.logo_url || '');
      setLogoFile(null);
      // Set input type based on existing logo
      setLogoInputType(service.logo_url ? 'url' : 'file');
    } else {
      setFormData({
        product_service: '',
        category: 'Software',
        duration: '',
        info_needed: '',
        cost: 0,
        selling_price: 0,
        logo_url: ''
      });
      setLogoPreview('');
      setLogoFile(null);
      setLogoUrlInput('');
      setLogoInputType('file');
    }
  }, [service]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (validateLogoFile(file)) {
        setLogoFile(file);
        setLogoUrlInput(''); // Clear URL input when file is selected
        const reader = new FileReader();
        reader.onload = () => {
          setLogoPreview(reader.result as string);
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
      // Clear any existing logo preview
      setLogoPreview('');
      // Update the form data to clear old logo
      setFormData({ ...formData, logo_url: '' });
      // Set new preview immediately
      setLogoPreview(url.trim());
    } else {
      // If URL is empty, clear everything
      setLogoPreview('');
      setFormData({ ...formData, logo_url: '' });
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
      } else if (logoInputType === 'url' && logoUrlInput.trim()) {
        // Use provided URL
        finalLogoUrl = logoUrlInput.trim();
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

  if (!isOpen) return null;

  const profit = formData.selling_price - formData.cost;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="ghost-card p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">
            {service ? 'Edit Service' : 'Add New Service'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Logo Upload Section - Enhanced styling */}
          <div>
            <label className="block text-sm font-medium mb-2">Service Logo</label>
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
                    className="absolute -top-2 -right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors shadow-lg hover:scale-110"
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
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200 ${
                    logoInputType === 'file'
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setLogoInputType('url')}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200 ${
                    logoInputType === 'url'
                      ? 'bg-blue-600 text-white shadow-lg'
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
            <label className="block text-sm font-medium mb-2">Product/Service</label>
            <input
              type="text"
              value={formData.product_service}
              onChange={(e) => setFormData({ ...formData, product_service: e.target.value })}
              className="ghost-input w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="ghost-select w-full"
            >
              {categories.sort().map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Duration</label>
            <input
              type="text"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              className="ghost-input w-full"
              placeholder="e.g. 1 month, 12 months"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Info Needed</label>
            <input
              type="text"
              value={formData.info_needed}
              onChange={(e) => setFormData({ ...formData, info_needed: e.target.value })}
              className="ghost-input w-full"
              placeholder="e.g. Email, Email+Password"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Cost ($)</label>
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
                className="ghost-input w-full"
                required
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Selling Price ($)</label>
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
                className="ghost-input w-full"
                required
                min="0"
              />
            </div>
          </div>

          <div className="p-3 bg-gray-700 rounded-lg">
            <div className="text-sm text-gray-300">Profit Preview:</div>
            <div className={`text-lg font-bold ${profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              ${profit.toFixed(2)}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="ghost-button flex-1 flex items-center justify-center gap-2"
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
              className="ghost-button-secondary px-6"
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