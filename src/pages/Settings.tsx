import React, { useState } from 'react';
import { Settings as SettingsIcon, Database, Shield, Bell, DollarSign } from 'lucide-react';
import { useCurrency } from '../lib/currency';
import { toast } from '../lib/toast';

export default function Settings() {
  const { currency, exchangeRate, setCurrency, setExchangeRate } = useCurrency();
  const [exchangeRateInput, setExchangeRateInput] = useState(exchangeRate.toString());

  const handleExchangeRateChange = (value: string) => {
    setExchangeRateInput(value);
  };

  const handleExchangeRateSave = () => {
    const rate = parseFloat(exchangeRateInput);
    if (isNaN(rate) || rate <= 0) {
      toast.show('Exchange rate must be a positive number', { type: 'error' });
      setExchangeRateInput(exchangeRate.toString());
      return;
    }
    if (rate > 100) {
      toast.show('Exchange rate seems unusually high. Please verify the value.', { type: 'warning' });
    }
    setExchangeRate(rate);
    toast.show('Exchange rate updated successfully', { type: 'success' });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Configure your dashboard preferences</p>
      </div>

      {/* Currency Settings */}
      <div className="ghost-card p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <DollarSign className="h-6 w-6 text-green-500" />
          <h2 className="text-xl font-bold text-white">Currency Settings</h2>
        </div>
        
        <div className="space-y-6">
          {/* Current Currency Display */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Current Currency
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrency('USD')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currency === 'USD'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                USD
              </button>
              <button
                onClick={() => setCurrency('TND')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currency === 'TND'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                TND
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              All monetary values will be displayed in {currency}
            </p>
          </div>

          {/* Exchange Rate Configuration */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Exchange Rate (USD to TND)
            </label>
            <div className="flex gap-3">
              <div className="flex-1">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="100"
                  value={exchangeRateInput}
                  onChange={(e) => handleExchangeRateChange(e.target.value)}
                  onBlur={handleExchangeRateSave}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleExchangeRateSave();
                    }
                  }}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
                  placeholder="3.00"
                />
              </div>
              <button
                onClick={handleExchangeRateSave}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Current rate: 1 USD = {exchangeRate.toFixed(2)} TND
            </p>
          </div>
        </div>
      </div>

      {/* Coming Soon Sections */}
      <div className="ghost-card p-8 text-center">
        <SettingsIcon className="h-16 w-16 text-gray-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">More Settings Coming Soon</h2>
        <p className="text-gray-400 mb-6">
          We're working on a comprehensive settings panel where you can customize your 
          dashboard experience, manage data, and configure preferences.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <div className="p-4 bg-gray-700 rounded-lg">
            <Database className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <h3 className="font-semibold text-white">Data Management</h3>
            <p className="text-sm text-gray-400">Import/export your data</p>
          </div>
          <div className="p-4 bg-gray-700 rounded-lg">
            <Shield className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <h3 className="font-semibold text-white">Security</h3>
            <p className="text-sm text-gray-400">Manage account security</p>
          </div>
          <div className="p-4 bg-gray-700 rounded-lg">
            <Bell className="h-8 w-8 text-purple-500 mx-auto mb-2" />
            <h3 className="font-semibold text-white">Notifications</h3>
            <p className="text-sm text-gray-400">Configure alert preferences</p>
          </div>
        </div>
      </div>
    </div>
  );
}