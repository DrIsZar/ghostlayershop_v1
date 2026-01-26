import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrency } from '../lib/currency';
import SearchableDropdown from './SearchableDropdown';

interface AddPayoutModalProps {
    onClose: () => void;
    onAdd: (source: string, amount: number, expectedDate: string, notes?: string) => Promise<void>;
}

export default function AddPayoutModal({ onClose, onAdd }: AddPayoutModalProps) {
    const { currency } = useCurrency();
    const today = new Date().toISOString().split('T')[0];

    const [source, setSource] = useState('stripe');
    const [customSource, setCustomSource] = useState('');
    const [amount, setAmount] = useState('');
    const [expectedDate, setExpectedDate] = useState(today);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sourceOptions = [
        { value: 'stripe', label: 'Stripe' },
        { value: 'paypal', label: 'PayPal' },
        { value: 'wise', label: 'Wise' },
        { value: 'bank', label: 'Bank Transfer' },
        { value: 'other', label: 'Other' }
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            setError('Please enter a valid amount');
            return;
        }

        const finalSource = source === 'other' ? customSource : source;
        if (!finalSource) {
            setError('Please specify a source');
            return;
        }

        setLoading(true);
        try {
            await onAdd(finalSource, amountNum, expectedDate, notes || undefined);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to add payout');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Plus className="h-5 w-5" />
                        Add Pending Payout
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Source */}
                        <SearchableDropdown
                            label="Source"
                            options={sourceOptions}
                            value={source}
                            onChange={setSource}
                            placeholder="Select source"
                            showSearchThreshold={10}
                        />

                        {/* Custom source if other */}
                        {source === 'other' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Source Name
                                </label>
                                <input
                                    type="text"
                                    value={customSource}
                                    onChange={(e) => setCustomSource(e.target.value)}
                                    placeholder="e.g., Gumroad"
                                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                />
                            </div>
                        )}

                        {/* Amount */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Amount ({currency})
                            </label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                min="0.01"
                                step="0.01"
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                        </div>

                        {/* Expected Date */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Expected Date
                            </label>
                            <input
                                type="date"
                                value={expectedDate}
                                onChange={(e) => setExpectedDate(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Notes (optional)
                            </label>
                            <input
                                type="text"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="e.g., Weekly payout"
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                        </div>

                        {/* Error */}
                        {error && (
                            <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
                                {error}
                            </p>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3 pt-2">
                            <Button
                                type="button"
                                variant="secondary"
                                className="flex-1"
                                onClick={onClose}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                className="flex-1 bg-green-600 hover:bg-green-700"
                                disabled={loading}
                            >
                                {loading ? 'Adding...' : 'Add Payout'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
