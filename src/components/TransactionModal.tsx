import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { Transaction, Service } from '../lib/supabase';
import type { Client } from '../types/client';
import { clientsDb } from '../lib/clients';
import ClientModal from './ClientModal';
import SearchableDropdown from './SearchableDropdown';

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
    date: new Date().toISOString().split('T')[0],
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
        date: new Date().toISOString().split('T')[0],
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

  if (!isOpen) return null;

  const profit = formData.selling_price - formData.cost_at_sale;
  const selectedService = services.find(s => s.id === formData.service_id);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="ghost-card p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">
            {transaction ? 'Edit Transaction' : 'Add New Transaction'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Client</label>
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
                className="ghost-button-secondary px-3 flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                New
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Service</label>
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
            <label className="block text-sm font-medium mb-2">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="ghost-input w-full"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Cost at Sale ($)</label>
              <input
                type="number"
                step="0.01"
                value={formData.cost_at_sale}
                onChange={(e) => setFormData({ ...formData, cost_at_sale: parseFloat(e.target.value) || 0 })}
                className="ghost-input w-full"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Selling Price ($)</label>
              <input
                type="number"
                step="0.01"
                value={formData.selling_price}
                onChange={(e) => setFormData({ ...formData, selling_price: parseFloat(e.target.value) || 0 })}
                className="ghost-input w-full"
                required
              />
            </div>
          </div>

          {selectedService && (
            <div className="p-3 bg-gray-700 rounded-lg">
              <div className="text-sm text-gray-300">Service Info:</div>
              <div className="text-sm text-white">{selectedService.category} • {selectedService.info_needed}</div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="ghost-input w-full h-20 resize-none"
              placeholder="Additional notes about this transaction..."
            />
          </div>

          <div className="p-3 bg-gray-700 rounded-lg">
            <div className="text-sm text-gray-300">Profit:</div>
            <div className={`text-lg font-bold ${profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              ${profit.toFixed(2)}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="ghost-button flex-1"
            >
              {transaction ? 'Update Transaction' : 'Add Transaction'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ghost-button-secondary px-6"
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