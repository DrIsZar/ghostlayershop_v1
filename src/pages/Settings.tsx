import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, User, Bell, Shield, Database, DollarSign } from 'lucide-react';
import { useCurrency } from '../lib/currency';

// shadcn/ui components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

export default function Settings() {
    const { currency, exchangeRate, setExchangeRate, formatCurrency } = useCurrency();
    const [activeTab, setActiveTab] = useState<'general' | 'notifications' | 'security' | 'data'>('general');
    const [tempExchangeRate, setTempExchangeRate] = useState<string>(exchangeRate.toString());
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

    // Update temp rate when the actual rate changes
    useEffect(() => {
        setTempExchangeRate(exchangeRate.toString());
    }, [exchangeRate]);

    const handleExchangeRateChange = (value: string) => {
        setTempExchangeRate(value);
    };

    const handleSaveExchangeRate = () => {
        const rate = parseFloat(tempExchangeRate);
        if (!isNaN(rate) && rate > 0) {
            setExchangeRate(rate);
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        }
    };

    const handleResetToDefault = () => {
        setTempExchangeRate('3.0');
        setExchangeRate(3.0);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Settings</h1>
                <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                    Manage your dashboard preferences and configuration
                </p>
            </div>

            {/* Tabs */}
            <Card>
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                    <div className="border-b border-border">
                        <TabsList className="h-auto p-2 bg-transparent">
                            <TabsTrigger value="general" className="data-[state=active]:bg-foreground data-[state=active]:text-background">
                                <User className="h-4 w-4 mr-2" />
                                General
                            </TabsTrigger>
                            <TabsTrigger value="notifications" className="data-[state=active]:bg-foreground data-[state=active]:text-background">
                                <Bell className="h-4 w-4 mr-2" />
                                Notifications
                            </TabsTrigger>
                            <TabsTrigger value="security" className="data-[state=active]:bg-foreground data-[state=active]:text-background">
                                <Shield className="h-4 w-4 mr-2" />
                                Security
                            </TabsTrigger>
                            <TabsTrigger value="data" className="data-[state=active]:bg-foreground data-[state=active]:text-background">
                                <Database className="h-4 w-4 mr-2" />
                                Data
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Tab Content */}
                    <CardContent className="p-6">
                        <TabsContent value="general" className="mt-0">
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-foreground mb-4">General Settings</h3>
                                    <div className="space-y-6">
                                        <div>
                                            <Label className="text-muted-foreground">Business Name</Label>
                                            <Input
                                                type="text"
                                                defaultValue="Upgrade TN"
                                                className="mt-2"
                                            />
                                        </div>

                                        {/* Currency Exchange Rate Configuration */}
                                        <div className="p-5 bg-secondary/30 border border-border rounded-lg">
                                            <div className="flex items-center gap-2 mb-4">
                                                <DollarSign className="h-5 w-5 text-green-400" />
                                                <h4 className="text-base font-semibold text-foreground">Currency Exchange Rate</h4>
                                            </div>

                                            <div className="space-y-4">
                                                <div>
                                                    <Label className="text-muted-foreground">USD to TND Exchange Rate</Label>
                                                    <p className="text-xs text-muted-foreground mb-3 mt-1">
                                                        Set the conversion rate from USD to TND. This rate is used when displaying amounts in TND.
                                                    </p>
                                                    <div className="flex gap-3 items-start">
                                                        <div className="flex-1">
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                min="0.01"
                                                                value={tempExchangeRate}
                                                                onChange={(e) => handleExchangeRateChange(e.target.value)}
                                                                placeholder="3.0"
                                                            />
                                                        </div>
                                                        <Button onClick={handleSaveExchangeRate}>
                                                            {saveStatus === 'saved' ? '✓ Saved' : 'Save Rate'}
                                                        </Button>
                                                        <Button variant="secondary" onClick={handleResetToDefault}>
                                                            Reset
                                                        </Button>
                                                    </div>
                                                </div>

                                                {/* Live Preview */}
                                                <div className="p-4 bg-background/50 rounded-lg border border-border">
                                                    <p className="text-xs font-medium text-muted-foreground mb-3">Preview Conversion</p>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <p className="text-xs text-muted-foreground/70 mb-1">USD</p>
                                                            <p className="text-lg font-bold text-foreground">$100.00</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-muted-foreground/70 mb-1">TND (using {parseFloat(tempExchangeRate || '0').toFixed(2)})</p>
                                                            <p className="text-lg font-bold text-green-400">
                                                                TND {(100 * parseFloat(tempExchangeRate || '0')).toFixed(2)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Current Display Info */}
                                                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                                    <div className="flex items-start gap-2">
                                                        <DollarSign className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                                                        <div>
                                                            <p className="text-sm text-blue-300 font-medium">Current Display Currency</p>
                                                            <p className="text-xs text-blue-400/80 mt-1">
                                                                You're currently viewing amounts in <strong>{currency}</strong>.
                                                                Use the toggle in the top-right corner to switch between currencies.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <Label className="text-muted-foreground">Timezone</Label>
                                            <select className="w-full mt-2 px-4 py-2 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                                                <option>Africa/Tunis (UTC+1)</option>
                                                <option>UTC</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="notifications" className="mt-0">
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-foreground mb-4">Notification Preferences</h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                                            <div>
                                                <p className="text-foreground font-medium">Subscription Renewals</p>
                                                <p className="text-sm text-muted-foreground">Get notified before subscriptions renew</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" defaultChecked className="sr-only peer" />
                                                <div className="w-11 h-6 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                            </label>
                                        </div>

                                        <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                                            <div>
                                                <p className="text-foreground font-medium">Low Cash Alerts</p>
                                                <p className="text-sm text-muted-foreground">Alert when cash runway is below 30 days</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" defaultChecked className="sr-only peer" />
                                                <div className="w-11 h-6 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                            </label>
                                        </div>

                                        <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                                            <div>
                                                <p className="text-foreground font-medium">Low Inventory</p>
                                                <p className="text-sm text-muted-foreground">Notify when inventory is running low</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" className="sr-only peer" />
                                                <div className="w-11 h-6 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="security" className="mt-0">
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-foreground mb-4">Security Settings</h3>
                                    <div className="space-y-4">
                                        <div className="p-4 bg-secondary/30 rounded-lg">
                                            <p className="text-foreground font-medium mb-2">Database Connection</p>
                                            <p className="text-sm text-muted-foreground">
                                                Connected to Supabase database
                                            </p>
                                            <div className="mt-3 flex items-center gap-2">
                                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                <Badge variant="success">Active</Badge>
                                            </div>
                                        </div>

                                        <div className="p-4 bg-secondary/30 rounded-lg">
                                            <p className="text-foreground font-medium mb-2">Session Management</p>
                                            <p className="text-sm text-muted-foreground mb-3">
                                                Manage your active sessions and security
                                            </p>
                                            <Button variant="secondary" size="sm">
                                                View Sessions
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="data" className="mt-0">
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-foreground mb-4">Data Management</h3>
                                    <div className="space-y-4">
                                        <div className="p-4 bg-secondary/30 rounded-lg">
                                            <p className="text-foreground font-medium mb-2">Export Data</p>
                                            <p className="text-sm text-muted-foreground mb-3">
                                                Export your transactions, subscriptions, and other data
                                            </p>
                                            <Button size="sm">
                                                Export All Data
                                            </Button>
                                        </div>

                                        <div className="p-4 bg-secondary/30 rounded-lg">
                                            <p className="text-foreground font-medium mb-2">Backup</p>
                                            <p className="text-sm text-muted-foreground mb-3">
                                                Your data is automatically backed up to Supabase
                                            </p>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Database className="h-4 w-4" />
                                                <span>Last backup: Today</span>
                                            </div>
                                        </div>

                                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                                            <p className="text-foreground font-medium mb-2">Danger Zone</p>
                                            <p className="text-sm text-muted-foreground mb-3">
                                                Irreversible actions that affect your data
                                            </p>
                                            <Button variant="destructive" size="sm">
                                                Clear All Data
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </CardContent>
                </Tabs>
            </Card>

            {/* Info Card */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                        <SettingsIcon className="h-6 w-6 text-muted-foreground flex-shrink-0 mt-1" />
                        <div>
                            <h3 className="text-foreground font-semibold mb-2">About Upgrade TN Dashboard</h3>
                            <p className="text-sm text-muted-foreground mb-2">
                                Version 2.0 - A comprehensive business management dashboard for subscription services
                            </p>
                            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground/70 mt-4">
                                <span>Built with React + TypeScript</span>
                                <span>•</span>
                                <span>Powered by Supabase</span>
                                <span>•</span>
                                <span>Deployed on Vercel</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
