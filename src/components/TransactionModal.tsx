import { useState, useEffect, useRef } from 'react';
import { X, Plus } from 'lucide-react';
import { Transaction, Service } from '../lib/supabase';
import type { Client } from '../types/client';
import { clientsDb } from '../lib/clients';
import ClientModal from './ClientModal';
import SearchableDropdown from './SearchableDropdown';
import { shouldIgnoreKeyboardEvent } from '../lib/useKeyboardShortcuts';
import { getTodayInTunisia } from '../lib/dateUtils';
import { useCurrency } from '../lib/currency';

// shadcn/ui components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'services'>) => void;
  transaction?: Transaction | null;
  services: Service[];
}

export default function TransactionModal({ isOpen, onClose, onSave, transaction, services }: TransactionModalProps) {
  const { formatCurrency, currency, exchangeRate } = useCurrency();
  const [formData, setFormData] = useState({
    service_id: '',
    client_id: '',
    date: getTodayInTunisia(),
    cost_at_sale: '' as string | number,
    selling_price: '' as string | number,
    notes: ''
  });

  const [clients, setClients] = useState<Client[]>([]);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Track if modal was previously open to avoid resetting on browser tab switch
  const wasOpen = useRef(false);
  const lastTransactionId = useRef<string | null>(null);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    // Only initialize form when modal transitions from closed to open
    // Or when editing a different transaction
    const isNewOpen = isOpen && !wasOpen.current;
    const isDifferentTransaction = transaction?.id !== lastTransactionId.current;

    if (isNewOpen || (isOpen && isDifferentTransaction)) {
      // When opening for edit, convert stored USD values to selected currency if needed
      if (transaction) {
        setFormData({
          service_id: transaction.service_id,
          client_id: transaction.client_id || '',
          date: transaction.date,
          cost_at_sale: currency === 'TND'
            ? Number((transaction.cost_at_sale * exchangeRate).toFixed(2))
            : transaction.cost_at_sale,
          selling_price: currency === 'TND'
            ? Number((transaction.selling_price * exchangeRate).toFixed(2))
            : transaction.selling_price,
          notes: transaction.notes
        });
        lastTransactionId.current = transaction.id;
      } else {
        // Reset form (default TND date is handled by getTodayInTunisia)
        setFormData({
          service_id: '',
          client_id: '',
          date: getTodayInTunisia(),
          cost_at_sale: '',
          selling_price: '',
          notes: ''
        });
        lastTransactionId.current = null;
      }
    }

    wasOpen.current = isOpen;
  }, [isOpen]);

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
      // Auto-fill prices, converting to selected currency if needed
      setFormData({
        ...formData,
        service_id: serviceId,
        cost_at_sale: currency === 'TND'
          ? Number((service.cost * exchangeRate).toFixed(2))
          : service.cost,
        selling_price: currency === 'TND'
          ? Number((service.selling_price * exchangeRate).toFixed(2))
          : service.selling_price
      });
    }
  };

  const handleInputChange = (field: 'cost_at_sale' | 'selling_price', value: string) => {
    // Remove leading zeros (e.g., "01" -> "1", but keep "0" or "0.5")
    let cleanValue = value;
    if (cleanValue.length > 1 && cleanValue.startsWith('0') && cleanValue[1] !== '.') {
      cleanValue = cleanValue.replace(/^0+/, '');
    }

    setFormData({ ...formData, [field]: cleanValue });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cost = parseFloat(formData.cost_at_sale.toString()) || 0;
    const price = parseFloat(formData.selling_price.toString()) || 0;

    // Convert back to USD (base currency) before saving if currently in TND
    const submissionData = {
      ...formData,
      cost_at_sale: currency === 'TND'
        ? cost / exchangeRate
        : cost,
      selling_price: currency === 'TND'
        ? price / exchangeRate
        : price
    };

    onSave(submissionData as any);
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

  const costNum = parseFloat(formData.cost_at_sale.toString()) || 0;
  const priceNum = parseFloat(formData.selling_price.toString()) || 0;
  const profit = priceNum - costNum;
  const selectedService = services.find(s => s.id === formData.service_id);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] animate-fade-in" style={{ top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', margin: 0, padding: '16px' }}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">
            {transaction ? 'Edit Transaction' : 'Add New Transaction'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <Label className="text-muted-foreground">Client</Label>
            <div className="flex gap-2 mt-2">
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
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsClientModalOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                New
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-muted-foreground">Service</Label>
            <div className="mt-2">
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
          </div>

          <div>
            <Label className="text-muted-foreground">Date</Label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="mt-2"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Cost at Sale ({currency})</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.cost_at_sale}
                onChange={(e) => handleInputChange('cost_at_sale', e.target.value)}
                className="mt-2"
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <Label className="text-muted-foreground">Selling Price ({currency})</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.selling_price}
                onChange={(e) => handleInputChange('selling_price', e.target.value)}
                className="mt-2"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {selectedService && (
            <div className="p-4 bg-secondary/30 border border-border rounded-lg">
              <div className="text-sm font-medium text-muted-foreground mb-1">Service Info:</div>
              <div className="text-sm text-foreground">{selectedService.category} • {selectedService.info_needed}</div>
            </div>
          )}

          <div>
            <Label className="text-muted-foreground">Notes (Optional)</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="mt-2"
              rows={3}
              placeholder="Additional notes about this transaction..."
            />
          </div>

          <div className="p-4 bg-secondary/30 border border-border rounded-lg">
            <div className="text-sm font-medium text-muted-foreground mb-1">Profit:</div>
            <div className={`text-2xl font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {currency === 'TND' ? `TND ${profit.toFixed(2)}` : formatCurrency(profit)}
            </div>
            <div className="text-xs text-muted-foreground/70 mt-1">
              {profit >= 0 ? 'Positive profit' : 'Negative profit - check pricing'}
            </div>
          </div>

          <div className="flex gap-3 pt-6 border-t border-border">
            <Button type="submit" className="flex-1">
              {transaction ? 'Update Transaction' : 'Add Transaction'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
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