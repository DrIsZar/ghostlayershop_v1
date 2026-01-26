import { Calendar, RefreshCw, CreditCard, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { UpcomingMoneyItem } from '../types/cashflow';
import { useCurrency } from '../lib/currency';

interface UpcomingMoneyProps {
    items: UpcomingMoneyItem[];
}

export default function UpcomingMoney({ items }: UpcomingMoneyProps) {
    const { formatCurrency } = useCurrency();

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === tomorrow.toDateString()) {
            return 'Tomorrow';
        } else {
            return date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });
        }
    };

    const getTypeIcon = (type: UpcomingMoneyItem['type']) => {
        switch (type) {
            case 'renewal':
                return <RefreshCw className="h-4 w-4 text-blue-400" />;
            case 'payout':
                return <CreditCard className="h-4 w-4 text-green-400" />;
            case 'estimate':
                return <TrendingUp className="h-4 w-4 text-gray-400" />;
        }
    };

    const getTypeBadge = (type: UpcomingMoneyItem['type']) => {
        switch (type) {
            case 'renewal':
                return 'bg-blue-500/20 text-blue-400';
            case 'payout':
                return 'bg-green-500/20 text-green-400';
            case 'estimate':
                return 'bg-gray-500/20 text-gray-400';
        }
    };

    const total = items.reduce((sum, item) => sum + item.amount, 0);

    return (
        <Card className="border-border">
            <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-gray-400" />
                        <h2 className="text-lg font-bold text-white">Upcoming Money</h2>
                    </div>
                    <span className="text-sm text-gray-400">Next 7 days</span>
                </div>

                {items.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No upcoming transactions</p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-3 mb-4">
                            {items.slice(0, 6).map((item, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${getTypeBadge(item.type)}`}>
                                            {getTypeIcon(item.type)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-white">
                                                {item.clientName || item.source}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {formatDate(item.date)} • {item.type === 'renewal' ? 'Renewal' : item.type === 'payout' ? 'Payout' : 'Estimate'}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-sm font-semibold text-green-400">
                                        +{formatCurrency(item.amount)}
                                    </span>
                                </div>
                            ))}

                            {items.length > 6 && (
                                <p className="text-center text-sm text-gray-500">
                                    +{items.length - 6} more items
                                </p>
                            )}
                        </div>

                        {/* 7-day total */}
                        <div className="pt-3 border-t border-gray-700">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-400">7-Day Outlook</span>
                                <span className="text-lg font-bold text-green-400">
                                    +{formatCurrency(total)}
                                </span>
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
