import { useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MoneyPoolWithStatus, MoneyPoolName } from '../types/cashflow';
import { useCurrency } from '../lib/currency';
import SearchableDropdown from './SearchableDropdown';

interface TransferMoneyModalProps {
    pools: MoneyPoolWithStatus[];
    onClose: () => void;
    onTransfer: (fromPool: MoneyPoolName | 'external', toPool: MoneyPoolName | 'external', amount: number, notes?: string) => Promise<void>;
}

export default function TransferMoneyModal({ pools, onClose, onTransfer }: TransferMoneyModalProps) {
    const { formatCurrency, currency } = useCurrency();
    const [fromPool, setFromPool] = useState<MoneyPoolName | 'external'>('business_vault');
    const [toPool, setToPool] = useState<MoneyPoolName | 'external'>('savings');
    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const poolOptions = [
        { value: 'business_vault', label: 'Business Vault' },
        { value: 'savings', label: 'Savings' },
        { value: 'personal', label: 'Personal' },
        { value: 'external', label: 'External (Add/Withdraw)' }
    ];

    const fromPoolData = pools.find(p => p.name === fromPool);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            setError('Please enter a valid amount');
            return;
        }

        if (fromPool === toPool) {
            setError('Source and destination must be different');
            return;
        }

        if (fromPool !== 'external' && fromPoolData && amountNum > fromPoolData.balance) {
            setError(`Insufficient balance in ${fromPoolData.display_name}`);
            return;
        }

        setLoading(true);
        try {
            await onTransfer(fromPool, toPool, amountNum, notes || undefined);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Transfer failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Move Money</CardTitle>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* From Pool */}
                        <SearchableDropdown
                            label="From"
                            options={poolOptions}
                            value={fromPool}
                            onChange={(v) => setFromPool(v as MoneyPoolName | 'external')}
                            placeholder="Select source"
                            showSearchThreshold={10}
                        />
                        {fromPool !== 'external' && fromPoolData && (
                            <p className="text-xs text-gray-500 -mt-2">
                                Available: {formatCurrency(fromPoolData.balance)}
                            </p>
                        )}

                        {/* Arrow indicator */}
                        <div className="flex justify-center">
                            <ArrowRight className="h-6 w-6 text-gray-500" />
                        </div>

                        {/* To Pool */}
                        <SearchableDropdown
                            label="To"
                            options={poolOptions}
                            value={toPool}
                            onChange={(v) => setToPool(v as MoneyPoolName | 'external')}
                            placeholder="Select destination"
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
                                min="0.01"
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
                                placeholder="e.g., Weekly savings transfer"
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
                                {loading ? 'Transferring...' : 'Transfer'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
