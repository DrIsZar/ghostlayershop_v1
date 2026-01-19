import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, User, Bell, Shield, Database, DollarSign } from 'lucide-react';
import { useCurrency } from '../lib/currency';

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
                <h1 className="text-2xl sm:text-3xl font-bold text-white">Settings</h1>
                <p className="text-gray-400 mt-1 text-sm sm:text-base">
                    Manage your dashboard preferences and configuration
                </p>
            </div>

            {/* Tabs */}
            <div className="ghost-card">
                <div className="flex flex-wrap gap-2 p-2 border-b border-gray-700/50">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${activeTab === 'general'
                                ? 'bg-white text-black'
                                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                            }`}
                    >
                        <User className="h-4 w-4" />
                        <span>General</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('notifications')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${activeTab === 'notifications'
                                ? 'bg-white text-black'
                                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                            }`}
                    >
                        <Bell className="h-4 w-4" />
                        <span>Notifications</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('security')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${activeTab === 'security'
                                ? 'bg-white text-black'
                                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                            }`}
                    >
                        <Shield className="h-4 w-4" />
                        <span>Security</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('data')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${activeTab === 'data'
                                ? 'bg-white text-black'
                                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                            }`}
                    >
                        <Database className="h-4 w-4" />
                        <span>Data</span>
                    </button>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                    {activeTab === 'general' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-4">General Settings</h3>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Business Name
                                        </label>
                                        <input
                                            type="text"
                                            defaultValue="Upgrade TN"
                                            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-white"
                                        />
                                    </div>

                                    {/* Currency Exchange Rate Configuration */}
                                    <div className="p-5 bg-gray-700/30 border border-gray-600/50 rounded-lg">
                                        <div className="flex items-center gap-2 mb-4">
                                            <DollarSign className="h-5 w-5 text-green-400" />
                                            <h4 className="text-base font-semibold text-white">Currency Exchange Rate</h4>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                                    USD to TND Exchange Rate
                                                </label>
                                                <p className="text-xs text-gray-400 mb-3">
                                                    Set the conversion rate from USD to TND. This rate is used when displaying amounts in TND.
                                                </p>
                                                <div className="flex gap-3 items-start">
                                                    <div className="flex-1">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0.01"
                                                            value={tempExchangeRate}
                                                            onChange={(e) => handleExchangeRateChange(e.target.value)}
                                                            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                                                            placeholder="3.0"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={handleSaveExchangeRate}
                                                        className="ghost-button px-4 py-2 text-sm whitespace-nowrap"
                                                    >
                                                        {saveStatus === 'saved' ? '✓ Saved' : 'Save Rate'}
                                                    </button>
                                                    <button
                                                        onClick={handleResetToDefault}
                                                        className="ghost-button-secondary px-4 py-2 text-sm whitespace-nowrap"
                                                    >
                                                        Reset
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Live Preview */}
                                            <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-600/30">
                                                <p className="text-xs font-medium text-gray-400 mb-3">Preview Conversion</p>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-xs text-gray-500 mb-1">USD</p>
                                                        <p className="text-lg font-bold text-white">$100.00</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 mb-1">TND (using {parseFloat(tempExchangeRate || '0').toFixed(2)})</p>
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
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Timezone
                                        </label>
                                        <select className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-white">
                                            <option>Africa/Tunis (UTC+1)</option>
                                            <option>UTC</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-4">Notification Preferences</h3>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                                        <div>
                                            <p className="text-white font-medium">Subscription Renewals</p>
                                            <p className="text-sm text-gray-400">Get notified before subscriptions renew</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" defaultChecked className="sr-only peer" />
                                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                        </label>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                                        <div>
                                            <p className="text-white font-medium">Low Cash Alerts</p>
                                            <p className="text-sm text-gray-400">Alert when cash runway is below 30 days</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" defaultChecked className="sr-only peer" />
                                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                        </label>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                                        <div>
                                            <p className="text-white font-medium">Low Inventory</p>
                                            <p className="text-sm text-gray-400">Notify when inventory is running low</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" className="sr-only peer" />
                                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-4">Security Settings</h3>
                                <div className="space-y-4">
                                    <div className="p-4 bg-gray-700/30 rounded-lg">
                                        <p className="text-white font-medium mb-2">Database Connection</p>
                                        <p className="text-sm text-gray-400">
                                            Connected to Supabase database
                                        </p>
                                        <div className="mt-3 flex items-center gap-2">
                                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                            <span className="text-sm text-green-400">Active</span>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-gray-700/30 rounded-lg">
                                        <p className="text-white font-medium mb-2">Session Management</p>
                                        <p className="text-sm text-gray-400 mb-3">
                                            Manage your active sessions and security
                                        </p>
                                        <button className="ghost-button-secondary text-sm px-4 py-2">
                                            View Sessions
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'data' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-4">Data Management</h3>
                                <div className="space-y-4">
                                    <div className="p-4 bg-gray-700/30 rounded-lg">
                                        <p className="text-white font-medium mb-2">Export Data</p>
                                        <p className="text-sm text-gray-400 mb-3">
                                            Export your transactions, subscriptions, and other data
                                        </p>
                                        <button className="ghost-button text-sm px-4 py-2">
                                            Export All Data
                                        </button>
                                    </div>

                                    <div className="p-4 bg-gray-700/30 rounded-lg">
                                        <p className="text-white font-medium mb-2">Backup</p>
                                        <p className="text-sm text-gray-400 mb-3">
                                            Your data is automatically backed up to Supabase
                                        </p>
                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                            <Database className="h-4 w-4" />
                                            <span>Last backup: Today</span>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                                        <p className="text-white font-medium mb-2">Danger Zone</p>
                                        <p className="text-sm text-gray-400 mb-3">
                                            Irreversible actions that affect your data
                                        </p>
                                        <button className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 px-4 py-2 rounded-lg text-sm transition-colors">
                                            Clear All Data
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Info Card */}
            <div className="ghost-card p-6">
                <div className="flex items-start gap-4">
                    <SettingsIcon className="h-6 w-6 text-gray-400 flex-shrink-0 mt-1" />
                    <div>
                        <h3 className="text-white font-semibold mb-2">About Upgrade TN Dashboard</h3>
                        <p className="text-sm text-gray-400 mb-2">
                            Version 2.0 - A comprehensive business management dashboard for subscription services
                        </p>
                        <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-4">
                            <span>Built with React + TypeScript</span>
                            <span>•</span>
                            <span>Powered by Supabase</span>
                            <span>•</span>
                            <span>Deployed on Vercel</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
