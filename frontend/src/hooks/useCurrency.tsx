import { type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  CurrencyContext,
  type CurrencyContextType,
  type DisplayCurrency,
  SUPPORTED_DISPLAY_CURRENCIES,
} from '@/context/CurrencyContext';
import { getUsdRate } from '@/services/CurrencyRateService';
import { ACCOUNTS_CHANGED_EVENT } from '@/utils/events';

const CURRENCY_STORAGE_KEY = 'sumurai.displayCurrency';

function isDisplayCurrency(value: string | null): value is DisplayCurrency {
  return SUPPORTED_DISPLAY_CURRENCIES.includes(value as DisplayCurrency);
}

export function useCurrency(): CurrencyContextType {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    return {
      currency: 'USD',
      rate: 1,
      rateDate: null,
      loading: false,
      error: null,
      setCurrency: () => {},
      format: (value) => {
        const numeric = Number(value);
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(Number.isFinite(numeric) ? numeric : 0);
      },
      formatConverted: (value) => {
        const numeric = Number(value);
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(Number.isFinite(numeric) ? numeric : 0);
      },
      convert: (value) => {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : 0;
      },
      refreshRate: async () => {},
    };
  }
  return context;
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<DisplayCurrency>(() => {
    if (typeof window === 'undefined') return 'USD';
    const stored = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    return isDisplayCurrency(stored) ? stored : 'USD';
  });
  const [rate, setRate] = useState(1);
  const [rateDate, setRateDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshRate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getUsdRate(currency);
      setRate(next.rate);
      setRateDate(next.date);
    } catch (err) {
      console.warn('Failed to refresh currency rate', err);
      setError('Could not refresh currency rate');
      if (currency === 'USD') {
        setRate(1);
      }
    } finally {
      setLoading(false);
    }
  }, [currency]);

  useEffect(() => {
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
    void refreshRate();
  }, [currency, refreshRate]);

  useEffect(() => {
    const handleAccountsChanged = () => {
      void refreshRate();
    };

    window.addEventListener(ACCOUNTS_CHANGED_EVENT, handleAccountsChanged);
    return () => window.removeEventListener(ACCOUNTS_CHANGED_EVENT, handleAccountsChanged);
  }, [refreshRate]);

  const setCurrency = useCallback((next: DisplayCurrency) => {
    setCurrencyState(next);
  }, []);

  const convert = useCallback(
    (value: number | string) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || Number.isNaN(numeric)) return 0;
      return numeric * rate;
    },
    [rate]
  );

  const formatConverted = useCallback(
    (value: number | string) => {
      const converted = Number(value);
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
      }).format(Number.isFinite(converted) ? converted : 0);
    },
    [currency]
  );

  const format = useCallback(
    (value: number | string) => {
      const converted = convert(value);
      return formatConverted(converted);
    },
    [convert, formatConverted]
  );

  const value = useMemo(
    (): CurrencyContextType => ({
      currency,
      rate,
      rateDate,
      loading,
      error,
      setCurrency,
      format,
      formatConverted,
      convert,
      refreshRate,
    }),
    [
      convert,
      currency,
      error,
      format,
      formatConverted,
      loading,
      rate,
      rateDate,
      refreshRate,
      setCurrency,
    ]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}
