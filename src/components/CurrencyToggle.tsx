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
      className="bg-card border border-border rounded-lg shadow-sm flex items-center gap-2.5 px-4 py-2.5 hover:bg-secondary transition-all duration-200 min-h-[44px]"
      aria-label={`Switch to ${currency === 'USD' ? 'TND' : 'USD'}`}
      title={`Current currency: ${currency}. Click to switch to ${currency === 'USD' ? 'TND' : 'USD'}`}
    >
      <span className="text-sm font-semibold text-foreground">
        {currency === 'USD' ? 'USD' : 'TND'}
      </span>
      <div className="w-9 h-5 bg-secondary rounded-full relative transition-colors">
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 shadow-md ${currency === 'USD'
            ? 'left-0.5 bg-foreground text-background'
            : 'left-[18px] bg-foreground text-background'
            }`}
        />
      </div>
    </button>
  );
}

