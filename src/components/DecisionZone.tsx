import { AlertTriangle, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { DecisionZone as DecisionZoneType } from '../types/cashflow';

interface DecisionZoneProps {
    data: DecisionZoneType;
}

export default function DecisionZone({ data }: DecisionZoneProps) {
    const getStatusStyles = () => {
        switch (data.status) {
            case 'green':
                return {
                    border: 'border-green-500/30',
                    bg: 'bg-green-500/5',
                    iconBg: 'bg-green-500/20',
                    icon: <CheckCircle className="h-6 w-6 text-green-400" />,
                    headlineColor: 'text-green-400'
                };
            case 'yellow':
                return {
                    border: 'border-yellow-500/30',
                    bg: 'bg-yellow-500/5',
                    iconBg: 'bg-yellow-500/20',
                    icon: <AlertCircle className="h-6 w-6 text-yellow-400" />,
                    headlineColor: 'text-yellow-400'
                };
            case 'red':
                return {
                    border: 'border-red-500/30',
                    bg: 'bg-red-500/5',
                    iconBg: 'bg-red-500/20',
                    icon: <AlertTriangle className="h-6 w-6 text-red-400" />,
                    headlineColor: 'text-red-400'
                };
        }
    };

    const styles = getStatusStyles();

    return (
        <Card className={`${styles.border} ${styles.bg}`}>
            <CardContent className="p-5">
                <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`p-3 rounded-lg ${styles.iconBg} flex-shrink-0`}>
                        {styles.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <h2 className={`text-lg font-bold ${styles.headlineColor} mb-2`}>
                            {data.headline}
                        </h2>
                        <p className="text-gray-300 mb-4">
                            {data.description}
                        </p>

                        {/* Suggested Actions */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                                Suggested Actions
                            </h3>
                            <ul className="space-y-2">
                                {data.suggestedActions.map((action, index) => (
                                    <li
                                        key={index}
                                        className="flex items-start gap-2 text-sm text-gray-300"
                                    >
                                        <ArrowRight className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                        <span>{action}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
