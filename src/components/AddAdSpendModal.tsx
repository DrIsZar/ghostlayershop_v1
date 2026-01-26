import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrency } from '../lib/currency';
import SearchableDropdown from './SearchableDropdown';

interface AddAdSpendModalProps {
    onClose: () => void;
    onAdd: (date: string, amount: number, platform: string, notes?: string) => Promise<void>;
}

export default function AddAdSpendModal({ onClose, onAdd }: AddAdSpendModalProps) {
    const { currency } = useCurrency();
    const today = new Date().toISOString().split('T')[0];

    const [date, setDate] = useState(today);
    const [amount, setAmount] = useState('');
    const [platform, setPlatform] = useState('meta');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const platformOptions = [
        { value: 'meta', label: 'Meta (Facebook/Instagram)' },
        { value: 'google', label: 'Google Ads' },
        { value: 'tiktok', label: 'TikTok' },
        { value: 'twitter', label: 'Twitter/X' },
        { value: 'other', label: 'Other' }
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum < 0) {
            setError('Please enter a valid amount');
            return;
        }

        setLoading(true);
        try {
            await onAdd(date, amountNum, platform, notes || undefined);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to add ad spend');
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
                        Add Ad Spend
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Date */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Date
                            </label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                max={today}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                        </div>

                        {/* Platform */}
                        <SearchableDropdown
                            label="Platform"
                            options={platformOptions}
                            value={platform}
                            onChange={setPlatform}
                            placeholder="Select platform"
                            showSearchThreshold={10}
                        />

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
                                min="0"
                                step="0.01"
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                                placeholder="e.g., Product launch campaign"
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
                                {loading ? 'Adding...' : 'Add Spend'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
