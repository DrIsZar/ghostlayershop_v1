import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Client } from '../types/client';
import { shouldIgnoreKeyboardEvent } from '../lib/useKeyboardShortcuts';

interface ClientModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (client: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
    initialData?: Client;
}

export default function ClientModal({ open, onClose, onSave, initialData }: ClientModalProps) {
    const [formData, setFormData] = useState({
        name: '',
        type: 'client' as 'client' | 'reseller',
        email: '',
        telegram: '',
        discord: '',
        notes: '',
        source: ''
    });

    // Reset form data when modal opens or initialData changes
    useEffect(() => {
        if (open) {
            setFormData({
                name: initialData?.name ?? '',
                type: initialData?.type ?? 'client',
                email: initialData?.email ?? '',
                telegram: initialData?.telegram ?? '',
                discord: initialData?.discord ?? '',
                notes: initialData?.notes ?? '',
                source: initialData?.source ?? ''
            });
    }
  }, [open, initialData]);

  // Keyboard shortcuts: Enter to save, Escape to close
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger if typing in an input/textarea
      if (shouldIgnoreKeyboardEvent(event) && event.key !== 'Escape') {
        return;
      }

      if (event.key === 'Enter') {
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
  }, [open, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await onSave(formData);
            onClose();
        } catch (error: any) {
            console.error('Error in client modal:', error);
            alert(error.message || 'Failed to save client. Please check if all required fields are filled correctly.');
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100]" style={{ top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', margin: 0, padding: '16px' }}>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="flex items-center justify-between p-6 border-b border-gray-700">
                    <h2 className="text-xl font-semibold text-white">
                        {initialData ? 'Edit Client' : 'Add New Client'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-700/50"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-3">
                            Client Type
                        </label>
                        <div className="flex gap-6">
                            <label className="inline-flex items-center">
                                <input
                                    type="radio"
                                    name="type"
                                    value="client"
                                    checked={formData.type === 'client'}
                                    onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as 'client' | 'reseller' }))}
                                    className="text-blue-600 focus:ring-blue-600 h-4 w-4 bg-gray-800 border-gray-600"
                                />
                                <span className="ml-2 text-sm font-medium text-white">Normal Client</span>
                            </label>
                            <label className="inline-flex items-center">
                                <input
                                    type="radio"
                                    name="type"
                                    value="reseller"
                                    checked={formData.type === 'reseller'}
                                    onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as 'client' | 'reseller' }))}
                                    className="text-blue-600 focus:ring-blue-600 h-4 w-4 bg-gray-800 border-gray-600"
                                />
                                <span className="ml-2 text-sm font-medium text-white">Reseller</span>
                            </label>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="name" className="block text-sm font-semibold text-gray-300 mb-2">
                            Name
                        </label>
                        <input
                            type="text"
                            name="name"
                            id="name"
                            required
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                            placeholder="Enter client name"
                            value={formData.name}
                            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label htmlFor="email" className="block text-sm font-semibold text-gray-300 mb-2">
                            Email
                        </label>
                        <input
                            type="email"
                            name="email"
                            id="email"
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                            placeholder="client@example.com"
                            value={formData.email}
                            onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label htmlFor="telegram" className="block text-sm font-semibold text-gray-300 mb-2">
                            Telegram
                        </label>
                        <input
                            type="text"
                            name="telegram"
                            id="telegram"
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                            placeholder="@username"
                            value={formData.telegram}
                            onChange={e => setFormData(prev => ({ ...prev, telegram: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label htmlFor="discord" className="block text-sm font-semibold text-gray-300 mb-2">
                            Discord
                        </label>
                        <input
                            type="text"
                            name="discord"
                            id="discord"
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                            placeholder="username#1234"
                            value={formData.discord}
                            onChange={e => setFormData(prev => ({ ...prev, discord: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label htmlFor="source" className="block text-sm font-semibold text-gray-300 mb-2">
                            How did they find you?
                        </label>
                        <input
                            type="text"
                            name="source"
                            id="source"
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                            placeholder="e.g. Google, Referral, Social Media"
                            value={formData.source}
                            onChange={e => setFormData(prev => ({ ...prev, source: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label htmlFor="notes" className="block text-sm font-semibold text-gray-300 mb-2">
                            Notes
                        </label>
                        <textarea
                            name="notes"
                            id="notes"
                            rows={3}
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors resize-none"
                            placeholder="Additional notes about this client..."
                            value={formData.notes}
                            onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                        />
                    </div>
                    <div className="flex gap-3 pt-6 border-t border-gray-700">
                        <button
                            type="submit"
                            className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200"
                        >
                            Save Client
                        </button>
                        <button
                            type="button"
                            className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors duration-200"
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
