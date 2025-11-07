import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { Transaction, Service } from '../lib/supabase';
import type { Client } from '../types/client';
import { clientsDb } from '../lib/clients';
import ClientModal from './ClientModal';
import SearchableDropdown from './SearchableDropdown';
import { shouldIgnoreKeyboardEvent } from '../lib/useKeyboardShortcuts';
import { getTodayInTunisia } from '../lib/dateUtils';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'services'>) => void;
  transaction?: Transaction | null;
  services: Service[];
}

export default function TransactionModal({ isOpen, onClose, onSave, transaction, services }: TransactionModalProps) {
  const [formData, setFormData] = useState({
    service_id: '',
    client_id: '',
    date: getTodayInTunisia(),
    cost_at_sale: 0,
    selling_price: 0,
    notes: ''
  });

  const [clients, setClients] = useState<Client[]>([]);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (transaction) {
      setFormData({
        service_id: transaction.service_id,
        client_id: transaction.client_id || '',
        date: transaction.date,
        cost_at_sale: transaction.cost_at_sale,
        selling_price: transaction.selling_price,
        notes: transaction.notes
      });
    } else {
      setFormData({
        service_id: '',
        client_id: '',
        date: getTodayInTunisia(),
        cost_at_sale: 0,
        selling_price: 0,
        notes: ''
      });
    }
  }, [transaction]);

  const loadClients = async () => {
    try {
      setLoading(true);
      const clientsList = await clientsDb.getAll();
      setClients(clientsList);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleServiceChange = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (service) {
      setFormData({
        ...formData,
        service_id: serviceId,
        cost_at_sale: service.cost,
        selling_price: service.selling_price
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  // Keyboard shortcuts: Enter to save, Escape to close
  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const profit = formData.selling_price - formData.cost_at_sale;
  const selectedService = services.find(s => s.id === formData.service_id);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100]" style={{ top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', margin: 0, padding: '16px' }}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">
            {transaction ? 'Edit Transaction' : 'Add New Transaction'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-700/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Client</label>
            <div className="flex gap-2">
              <SearchableDropdown
                options={[
                  { value: '', label: 'Select a client' },
                  ...clients.map(client => ({
                    value: client.id,
                    label: `${client.name} ${client.email ? `(${client.email})` : ''}`
                  }))
                ]}
                value={formData.client_id}
                onChange={(value) => setFormData({ ...formData, client_id: value })}
                placeholder="Select a client"
                searchPlaceholder="Search clients..."
                className="flex-1"
                showSearchThreshold={5}
                required
              />
              <button
                type="button"
                onClick={() => setIsClientModalOpen(true)}
                className="px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                New
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Service</label>
            <SearchableDropdown
              options={[
                { value: '', label: 'Select a service' },
                ...services.map(service => ({
                  value: service.id,
                  label: `${service.product_service} - ${service.duration}`
                }))
              ]}
              value={formData.service_id}
              onChange={(value) => handleServiceChange(value)}
              placeholder="Select a service"
              searchPlaceholder="Search services..."
              className="w-full"
              showSearchThreshold={5}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Cost at Sale ($)</label>
              <input
                type="number"
                step="0.01"
                value={formData.cost_at_sale}
                onChange={(e) => setFormData({ ...formData, cost_at_sale: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Selling Price ($)</label>
              <input
                type="number"
                step="0.01"
                value={formData.selling_price}
                onChange={(e) => setFormData({ ...formData, selling_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {selectedService && (
            <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
              <div className="text-sm font-medium text-gray-300 mb-1">Service Info:</div>
              <div className="text-sm text-white">{selectedService.category} • {selectedService.info_needed}</div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Notes (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors resize-none"
              rows={3}
              placeholder="Additional notes about this transaction..."
            />
          </div>

          <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
            <div className="text-sm font-medium text-gray-300 mb-1">Profit:</div>
            <div className={`text-2xl font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${profit.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {profit >= 0 ? 'Positive profit' : 'Negative profit - check pricing'}
            </div>
          </div>

          <div className="flex gap-3 pt-6 border-t border-gray-700">
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200"
            >
              {transaction ? 'Update Transaction' : 'Add Transaction'}
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

      <ClientModal
        open={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        onSave={async (clientData) => {
          try {
            const newClient = await clientsDb.create(clientData);
            await loadClients();
            setFormData(prev => ({ ...prev, client_id: newClient.id }));
            setIsClientModalOpen(false);
          } catch (error) {
            console.error('Error creating client:', error);
            alert('Error creating client. Please try again.');
          }
        }}
      />
    </div>
  );
}