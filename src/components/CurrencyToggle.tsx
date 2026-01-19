import React from 'react';
import { useCurrency } from '../lib/currency';

export default function CurrencyToggle() {
  const { currency, setCurrency } = useCurrency();

  const handleToggle = () => {
    setCurrency(currency === 'USD' ? 'TND' : 'USD');
  };

  return (
    <button
      onClick={handleToggle}
      className="ghost-card flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-700/50 transition-all duration-200 min-h-[44px]"
      aria-label={`Switch to ${currency === 'USD' ? 'TND' : 'USD'}`}
      title={`Current currency: ${currency}. Click to switch to ${currency === 'USD' ? 'TND' : 'USD'}`}
    >
      <span className="text-sm font-semibold text-white">
        {currency === 'USD' ? 'USD' : 'TND'}
      </span>
      <div className="w-9 h-5 bg-gray-600 rounded-full relative transition-colors">
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 shadow-md ${currency === 'USD'
            ? 'left-0.5 bg-white text-black'
            : 'left-[18px] bg-white text-black'
            }`}
        />
      </div>
    </button>
  );
}

