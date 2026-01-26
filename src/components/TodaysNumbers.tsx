import { DollarSign, TrendingUp, TrendingDown, Clock, ShoppingCart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { TodaysNumbers as TodaysNumbersType } from '../types/cashflow';
import { useCurrency } from '../lib/currency';

interface TodaysNumbersProps {
    data: TodaysNumbersType;
}

export default function TodaysNumbers({ data }: TodaysNumbersProps) {
    const { formatCurrency } = useCurrency();

    const isPositive = data.netProfit >= 0;
    const profitColor = isPositive ? 'text-green-400' : 'text-red-400';
    const profitBg = isPositive ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5';

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Today's Numbers</h2>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Revenue */}
                <Card className="border-border">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-400">Revenue</span>
                            <DollarSign className="h-4 w-4 text-gray-400" />
                        </div>
                        <p className="text-2xl font-bold text-green-400">
                            {formatCurrency(data.revenue)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            {data.salesCount} sale{data.salesCount !== 1 ? 's' : ''}
                        </p>
                    </CardContent>
                </Card>

                {/* Ad Spend */}
                <Card className="border-border">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-400">Ad Spend</span>
                            <ShoppingCart className="h-4 w-4 text-gray-400" />
                        </div>
                        <p className="text-2xl font-bold text-white">
                            {data.adSpend > 0 ? '-' : ''}{formatCurrency(data.adSpend)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            Paid campaigns
                        </p>
                    </CardContent>
                </Card>

                {/* Net Profit */}
                <Card className={`transition-all ${profitBg}`}>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-400">Net Today</span>
                            {isPositive ? (
                                <TrendingUp className="h-4 w-4 text-green-400" />
                            ) : (
                                <TrendingDown className="h-4 w-4 text-red-400" />
                            )}
                        </div>
                        <p className={`text-2xl font-bold ${profitColor}`}>
                            {isPositive ? '+' : ''}{formatCurrency(data.netProfit)}
                        </p>
                        <p className={`text-xs mt-1 ${profitColor}`}>
                            {isPositive ? '🟢 Profitable' : '🔴 Loss'}
                        </p>
                    </CardContent>
                </Card>

                {/* Pending Payouts */}
                <Card className="border-border">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-400">Pending</span>
                            <Clock className="h-4 w-4 text-gray-400" />
                        </div>
                        <p className="text-2xl font-bold text-white">
                            {formatCurrency(data.pendingPayouts)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            {data.pendingPayoutDays !== null
                                ? `${data.pendingPayoutDays} day${data.pendingPayoutDays !== 1 ? 's' : ''} out`
                                : 'No pending payouts'}
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
