import { useState } from 'react';
import { Wallet, PiggyBank, User, ArrowRightLeft, Target, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MoneyPoolWithStatus, MoneyPoolName } from '../types/cashflow';
import { useCurrency } from '../lib/currency';

interface MoneyPoolsProps {
    pools: MoneyPoolWithStatus[];
    onTransfer: () => void;
    onEditTarget: (poolName: MoneyPoolName) => void;
}

const poolIcons: Record<MoneyPoolName, React.ReactNode> = {
    business_vault: <Wallet className="h-6 w-6" />,
    savings: <PiggyBank className="h-6 w-6" />,
    personal: <User className="h-6 w-6" />
};

const poolOrder: MoneyPoolName[] = ['business_vault', 'savings', 'personal'];

export default function MoneyPools({ pools, onTransfer, onEditTarget }: MoneyPoolsProps) {
    const { formatCurrency } = useCurrency();
    const [editingPool, setEditingPool] = useState<MoneyPoolName | null>(null);

    // Sort pools in consistent order
    const sortedPools = poolOrder
        .map(name => pools.find(p => p.name === name))
        .filter((p): p is MoneyPoolWithStatus => p !== undefined);

    const getStatusColor = (status: MoneyPoolWithStatus['status']) => {
        switch (status) {
            case 'green':
                return 'border-green-500/30 bg-green-500/5';
            case 'yellow':
                return 'border-yellow-500/30 bg-yellow-500/5';
            case 'red':
                return 'border-red-500/30 bg-red-500/5';
        }
    };

    const getStatusTextColor = (status: MoneyPoolWithStatus['status']) => {
        switch (status) {
            case 'green':
                return 'text-green-400';
            case 'yellow':
                return 'text-yellow-400';
            case 'red':
                return 'text-red-400';
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Money Pools</h2>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={onTransfer}
                    className="gap-2"
                >
                    <ArrowRightLeft className="h-4 w-4" />
                    Move Money
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {sortedPools.map((pool) => (
                    <Card
                        key={pool.id}
                        className={`transition-all duration-200 hover:scale-[1.02] ${getStatusColor(pool.status)}`}
                    >
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg bg-gray-800 ${getStatusTextColor(pool.status)}`}>
                                        {poolIcons[pool.name]}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-white">{pool.display_name}</h3>
                                        <button
                                            onClick={() => onEditTarget(pool.name)}
                                            className="text-xs text-gray-400 hover:text-gray-300 flex items-center gap-1"
                                        >
                                            <Target className="h-3 w-3" />
                                            Target: {formatCurrency(pool.target)}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className={`text-3xl font-bold ${getStatusTextColor(pool.status)}`}>
                                    {formatCurrency(pool.balance)}
                                </p>

                                {pool.status !== 'green' && pool.deficit > 0 && (
                                    <div className="flex items-center gap-1 text-sm">
                                        <TrendingDown className="h-4 w-4 text-red-400" />
                                        <span className="text-red-400">
                                            {formatCurrency(pool.deficit)} below target
                                        </span>
                                    </div>
                                )}

                                {pool.status === 'green' && (
                                    <div className="flex items-center gap-1 text-sm">
                                        <TrendingUp className="h-4 w-4 text-green-400" />
                                        <span className="text-green-400">On target</span>
                                    </div>
                                )}
                            </div>

                            {/* Progress bar */}
                            <div className="mt-4">
                                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${pool.status === 'green'
                                                ? 'bg-green-500'
                                                : pool.status === 'yellow'
                                                    ? 'bg-yellow-500'
                                                    : 'bg-red-500'
                                            }`}
                                        style={{
                                            width: `${Math.min(100, (pool.balance / pool.target) * 100)}%`
                                        }}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
