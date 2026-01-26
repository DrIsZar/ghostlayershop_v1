import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { WeeklyPulse as WeeklyPulseType } from '../types/cashflow';
import { useCurrency } from '../lib/currency';

interface WeeklyPulseProps {
    data: WeeklyPulseType;
}

export default function WeeklyPulse({ data }: WeeklyPulseProps) {
    const { formatCurrency } = useCurrency();

    // Find max absolute value for scaling
    const maxValue = Math.max(
        ...data.days.map(d => Math.abs(d.netProfit)),
        1 // Prevent division by zero
    );

    const isPositiveWeek = data.weekTotal >= 0;
    const isVsLastWeekPositive = data.vsLastWeek >= 0;

    return (
        <Card className="border-border">
            <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-white">Weekly Pulse</h2>
                    <div className="flex items-center gap-4 text-sm">
                        <span className={`font-semibold ${isPositiveWeek ? 'text-green-400' : 'text-red-400'}`}>
                            {isPositiveWeek ? '+' : ''}{formatCurrency(data.weekTotal)}
                        </span>
                        <span className="text-gray-500">|</span>
                        <span className={`flex items-center gap-1 ${isVsLastWeekPositive ? 'text-green-400' : 'text-red-400'}`}>
                            {isVsLastWeekPositive ? (
                                <TrendingUp className="h-4 w-4" />
                            ) : (
                                <TrendingDown className="h-4 w-4" />
                            )}
                            {data.vsLastWeek > 0 ? '+' : ''}{data.vsLastWeek}% vs last week
                        </span>
                    </div>
                </div>

                {/* Progress to target */}
                <div className="mb-6">
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">Progress to Target</span>
                        <span className={data.percentAchieved >= 100 ? 'text-green-400' : 'text-gray-300'}>
                            {data.percentAchieved}% of {formatCurrency(data.weekTarget)}
                        </span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${data.percentAchieved >= 100
                                    ? 'bg-green-500'
                                    : data.percentAchieved >= 50
                                        ? 'bg-yellow-500'
                                        : 'bg-red-500'
                                }`}
                            style={{ width: `${Math.min(100, data.percentAchieved)}%` }}
                        />
                    </div>
                </div>

                {/* Daily bars */}
                <div className="flex items-end justify-between gap-2 h-32">
                    {data.days.map((day) => {
                        const height = (Math.abs(day.netProfit) / maxValue) * 100;
                        const isPositive = day.netProfit >= 0;

                        return (
                            <div
                                key={day.date}
                                className="flex-1 flex flex-col items-center"
                            >
                                {/* Value */}
                                <span className={`text-xs mb-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                    {day.netProfit !== 0 ? (isPositive ? '+' : '') + Math.round(day.netProfit) : '-'}
                                </span>

                                {/* Bar */}
                                <div className="w-full flex flex-col items-center" style={{ height: '80px' }}>
                                    <div
                                        className={`w-full rounded-t transition-all duration-300 ${day.isToday
                                                ? 'ring-2 ring-white/50'
                                                : ''
                                            } ${isPositive ? 'bg-green-500/80' : 'bg-red-500/80'
                                            }`}
                                        style={{
                                            height: `${Math.max(height, 4)}%`,
                                            marginTop: 'auto'
                                        }}
                                    />
                                </div>

                                {/* Day label */}
                                <span className={`text-xs mt-2 ${day.isToday ? 'text-white font-bold' : 'text-gray-500'}`}>
                                    {day.dayName}
                                </span>
                            </div>
                        );
                    })}

                    {/* Remaining days of the week (future) */}
                    {Array.from({ length: 7 - data.days.length }).map((_, i) => (
                        <div key={`future-${i}`} className="flex-1 flex flex-col items-center">
                            <span className="text-xs mb-1 text-gray-600">-</span>
                            <div className="w-full flex flex-col items-center" style={{ height: '80px' }}>
                                <div
                                    className="w-full rounded-t bg-gray-700/30"
                                    style={{ height: '4%', marginTop: 'auto' }}
                                />
                            </div>
                            <span className="text-xs mt-2 text-gray-600">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][data.days.length + i]}
                            </span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
