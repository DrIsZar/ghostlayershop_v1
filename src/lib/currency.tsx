import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Currency = 'USD' | 'TND';

interface CurrencyContextType {
  currency: Currency;
  exchangeRate: number;
  setCurrency: (currency: Currency) => void;
  setExchangeRate: (rate: number) => void;
  convertAmount: (amount: number) => number;
  formatCurrency: (amount: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const STORAGE_KEYS = {
  CURRENCY: 'currency.selectedCurrency',
  EXCHANGE_RATE: 'currency.exchangeRate',
};

const DEFAULT_EXCHANGE_RATE = 3.0;
const DEFAULT_CURRENCY: Currency = 'USD';

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.CURRENCY);
    return (stored === 'USD' || stored === 'TND') ? stored : DEFAULT_CURRENCY;
  });

  const [exchangeRate, setExchangeRateState] = useState<number>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.EXCHANGE_RATE);
    if (stored) {
      const rate = parseFloat(stored);
      if (!isNaN(rate) && rate > 0) {
        return rate;
      }
    }
    return DEFAULT_EXCHANGE_RATE;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CURRENCY, currency);
  }, [currency]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.EXCHANGE_RATE, exchangeRate.toString());
  }, [exchangeRate]);

  const setCurrency = (newCurrency: Currency) => {
    setCurrencyState(newCurrency);
  };

  const setExchangeRate = (rate: number) => {
    if (rate > 0 && !isNaN(rate)) {
      setExchangeRateState(rate);
    }
  };

  const convertAmount = (amount: number): number => {
    if (currency === 'TND') {
      return amount * exchangeRate;
    }
    return amount;
  };

  const formatCurrency = (amount: number): string => {
    const converted = convertAmount(amount);
    const formatted = converted.toFixed(2);
    
    if (currency === 'TND') {
      return `TND ${formatted}`;
    }
    return `$${formatted}`;
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        exchangeRate,
        setCurrency,
        setExchangeRate,
        convertAmount,
        formatCurrency,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}


