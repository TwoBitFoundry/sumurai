import { AnimatePresence } from 'framer-motion';
import {
  Building2,
  Clock,
  CreditCard,
  Home,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, cn, GlassCard, Input } from '@/ui/primitives';
import { getProviderCardConfig } from '@/utils/providerCards';
import { Toast } from '../components/Toast';
import HeroStatCard from '../components/widgets/HeroStatCard';
import { type DisplayCurrency, SUPPORTED_DISPLAY_CURRENCIES } from '../context/CurrencyContext';
import ConnectionsList from '../features/plaid/components/ConnectionsList';
import { usePlaidLinkFlow } from '../features/plaid/hooks/usePlaidLinkFlow';
import { useCurrency } from '../hooks/useCurrency';
import { useTellerLinkFlow } from '../hooks/useTellerLinkFlow';
import { useTellerProviderInfo } from '../hooks/useTellerProviderInfo';
import { PageLayout } from '../layouts/PageLayout';
import { getUsdRate } from '../services/CurrencyRateService';
import { ManualAssetService } from '../services/ManualAssetService';
import { ManualInvestmentService } from '../services/ManualInvestmentService';
import { ProviderCatalog } from '../services/ProviderCatalog';
import type {
  Account,
  FinancialProvider,
  ManualAssetAccountType,
  ManualAssetRequest,
  ManualInvestmentRequest,
} from '../types/api';
import { dispatchAccountsChanged } from '../utils/events';

const formatRelativeTime = (iso: string): string => {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return 'Unknown';
  }

  const now = Date.now();
  const diff = Math.max(0, now - timestamp);

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;
  const year = 365 * day;

  if (diff < minute) return 'just now';
  if (diff < hour) return `${Math.round(diff / minute)}m ago`;
  if (diff < day) return `${Math.round(diff / hour)}h ago`;
  if (diff < month) return `${Math.round(diff / day)}d ago`;
  if (diff < year) return `${Math.round(diff / month)}mo ago`;
  return `${Math.round(diff / year)}y ago`;
};

const formatAbsoluteTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown timestamp';
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const parseAccountBalance = (value: Account['balance_current']): number => {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isManualInvestmentAccount = (account: Account) =>
  account.account_type === 'investment' &&
  !account.provider_connection_id &&
  !account.provider_account_id;

const isManualPropertyAccount = (account: Account) =>
  ['property', 'real_estate', 'loan'].includes(account.account_type) &&
  !account.provider_connection_id &&
  !account.provider_account_id;

const formatManualInvestmentTitle = (account: Account) =>
  account.institution_name?.trim() || account.name || 'Manual investment';

const formatManualInvestmentDetail = (account: Account) => {
  const detail = account.name?.trim();
  const type = account.account_type?.trim();
  const parts = [detail, type].filter(Boolean);
  return parts.length > 0 ? parts.join(' • ') : 'Manual investment';
};

const getManualPropertyInstitutionName = (accountType: ManualAssetAccountType) =>
  accountType === 'loan' ? 'Mortgage' : 'Property';

type ManualInvestmentFormState = {
  institution_name: string;
  name: string;
  balance_current: string;
  currency: DisplayCurrency;
  conversion_rate: string;
  mask: string;
};

type ManualPropertyFormState = {
  name: string;
  account_type: ManualAssetAccountType;
  balance_current: string;
};

const emptyManualInvestmentForm: ManualInvestmentFormState = {
  institution_name: 'Robinhood',
  name: 'Brokerage',
  balance_current: '',
  currency: 'USD',
  conversion_rate: '1',
  mask: '',
};

const emptyManualPropertyForm: ManualPropertyFormState = {
  name: 'Primary Home',
  account_type: 'property',
  balance_current: '',
};

interface AccountsPageProps {
  onError?: (message: string | null) => void;
  onAccountSelect?: (accountId: string) => void;
}

const AccountsPage = ({ onError, onAccountSelect }: AccountsPageProps) => {
  const { format } = useCurrency();
  const providerInfo = useTellerProviderInfo();
  const selectedProvider = providerInfo.selectedProvider;
  const providerLoading = providerInfo.loading;
  const providerError = providerInfo.error;
  const [selectingProvider, setSelectingProvider] = useState<string | null>(null);
  const [manualInvestments, setManualInvestments] = useState<Account[]>([]);
  const [manualPropertyAccounts, setManualPropertyAccounts] = useState<Account[]>([]);
  const [manualForm, setManualForm] =
    useState<ManualInvestmentFormState>(emptyManualInvestmentForm);
  const [manualPropertyForm, setManualPropertyForm] =
    useState<ManualPropertyFormState>(emptyManualPropertyForm);
  const [editingManualId, setEditingManualId] = useState<string | null>(null);
  const [editingManualPropertyId, setEditingManualPropertyId] = useState<string | null>(null);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualPropertySaving, setManualPropertySaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualPropertyError, setManualPropertyError] = useState<string | null>(null);
  const [manualRateLoading, setManualRateLoading] = useState(false);
  const [manualRateError, setManualRateError] = useState<string | null>(null);
  const [manualRateDate, setManualRateDate] = useState<string | null>(null);
  const pendingConnectProviderRef = useRef<FinancialProvider | null>(null);

  const loadManualInvestments = useCallback(async () => {
    try {
      const accounts = await ProviderCatalog.getAccounts();
      setManualInvestments(accounts.filter(isManualInvestmentAccount));
      setManualPropertyAccounts(accounts.filter(isManualPropertyAccount));
    } catch (err) {
      console.warn('Failed to load manual investments', err);
      setManualInvestments([]);
      setManualPropertyAccounts([]);
    }
  }, []);

  useEffect(() => {
    loadManualInvestments();
  }, [loadManualInvestments]);

  useEffect(() => {
    if (providerError) {
      onError?.(providerError);
    } else if (!providerLoading && selectedProvider) {
      onError?.(null);
    }
  }, [onError, providerError, providerLoading, selectedProvider]);

  const plaidFlow = usePlaidLinkFlow({ onError, enabled: selectedProvider === 'plaid' });
  const tellerFlow = useTellerLinkFlow({
    applicationId: providerInfo.tellerApplicationId,
    environment: providerInfo.tellerEnvironment,
    onError,
    enabled: selectedProvider === 'teller',
  });
  const plaidConnect = plaidFlow.connect;
  const tellerConnect = tellerFlow.connect;

  const flow = selectedProvider === 'teller' ? tellerFlow : plaidFlow;

  const {
    connections,
    toast,
    setToast,
    syncOne,
    syncAll,
    disconnect,
    syncingAll,
    loading: flowLoading,
    error: flowError,
  } = flow;

  const handleProviderSelect = useCallback(
    async (provider: FinancialProvider) => {
      setSelectingProvider(provider);
      try {
        await providerInfo.chooseProvider(provider);
      } catch (err) {
        console.warn('Failed to select provider', err);
        onError?.('Failed to select provider');
      } finally {
        setSelectingProvider(null);
      }
    },
    [onError, providerInfo]
  );

  useEffect(() => {
    const pendingProvider = pendingConnectProviderRef.current;
    if (!pendingProvider || selectedProvider !== pendingProvider || selectingProvider !== null) {
      return;
    }

    pendingConnectProviderRef.current = null;
    const nextConnect = pendingProvider === 'teller' ? tellerConnect : plaidConnect;
    void nextConnect().catch((err) => {
      console.warn(`Failed to launch ${pendingProvider} connect`, err);
    });
  }, [plaidConnect, selectedProvider, selectingProvider, tellerConnect]);

  const handleConnectProvider = useCallback(
    async (provider: FinancialProvider) => {
      if (provider === 'teller' && !providerInfo.tellerApplicationId) {
        onError?.('Missing Teller application ID');
        return;
      }

      if (selectedProvider === provider) {
        await (provider === 'teller' ? tellerConnect() : plaidConnect());
        return;
      }

      pendingConnectProviderRef.current = provider;
      await handleProviderSelect(provider);
    },
    [
      handleProviderSelect,
      onError,
      plaidConnect,
      providerInfo.tellerApplicationId,
      selectedProvider,
      tellerConnect,
    ]
  );

  const resetManualForm = useCallback(() => {
    setEditingManualId(null);
    setManualForm(emptyManualInvestmentForm);
    setManualError(null);
  }, []);

  const resetManualPropertyForm = useCallback(() => {
    setEditingManualPropertyId(null);
    setManualPropertyForm(emptyManualPropertyForm);
    setManualPropertyError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadManualInvestmentRate() {
      setManualRateLoading(true);
      setManualRateError(null);
      try {
        const next = await getUsdRate(manualForm.currency);
        if (cancelled) return;

        const nativeToUsdRate = next.rate > 0 ? 1 / next.rate : 1;
        setManualForm((prev) =>
          prev.currency === manualForm.currency
            ? {
                ...prev,
                conversion_rate: nativeToUsdRate.toFixed(8),
              }
            : prev
        );
        setManualRateDate(next.date);
      } catch (err) {
        if (cancelled) return;
        console.warn('Failed to load manual investment currency rate', err);
        setManualRateError('Could not load the currency rate.');
      } finally {
        if (!cancelled) {
          setManualRateLoading(false);
        }
      }
    }

    void loadManualInvestmentRate();

    return () => {
      cancelled = true;
    };
  }, [manualForm.currency]);

  const manualInvestmentPayload = useCallback((): ManualInvestmentRequest | null => {
    const institution = manualForm.institution_name.trim();
    const name = manualForm.name.trim();
    const balance = Number(manualForm.balance_current);
    const conversionRate = Number(manualForm.conversion_rate || '1');

    if (
      !institution ||
      !name ||
      !Number.isFinite(balance) ||
      balance < 0 ||
      !Number.isFinite(conversionRate) ||
      conversionRate <= 0
    ) {
      setManualError('Enter an institution, account name, balance, and currency.');
      return null;
    }

    if (manualRateLoading || manualRateError) {
      setManualError('Wait for the currency rate to load before saving.');
      return null;
    }

    return {
      institution_name: institution,
      name,
      balance_current: Number((balance * conversionRate).toFixed(2)),
      mask: manualForm.mask.trim() || null,
    };
  }, [manualForm, manualRateError, manualRateLoading]);

  const saveManualInvestment = useCallback(async () => {
    const payload = manualInvestmentPayload();
    if (!payload) return;

    setManualSaving(true);
    setManualError(null);
    try {
      if (editingManualId) {
        await ManualInvestmentService.update(editingManualId, payload);
        setToast('Investment balance updated');
      } else {
        await ManualInvestmentService.create(payload);
        setToast('Investment account added');
      }
      resetManualForm();
      await loadManualInvestments();
      dispatchAccountsChanged();
    } catch (err) {
      console.warn('Failed to save manual investment', err);
      setManualError('Could not save this investment account.');
    } finally {
      setManualSaving(false);
    }
  }, [editingManualId, loadManualInvestments, manualInvestmentPayload, resetManualForm, setToast]);

  const editManualInvestment = useCallback((account: Account) => {
    setEditingManualId(account.id);
    setManualError(null);
    setManualForm({
      institution_name: account.institution_name || 'Investment',
      name: account.name,
      balance_current: String(parseAccountBalance(account.balance_current)),
      currency: 'USD',
      conversion_rate: '1',
      mask: account.mask || '',
    });
  }, []);

  const deleteManualInvestment = useCallback(
    async (account: Account) => {
      setManualSaving(true);
      setManualError(null);
      try {
        await ManualInvestmentService.delete(account.id);
        setToast('Investment account removed');
        if (editingManualId === account.id) {
          resetManualForm();
        }
        await loadManualInvestments();
        dispatchAccountsChanged();
      } catch (err) {
        console.warn('Failed to delete manual investment', err);
        setManualError('Could not remove this investment account.');
      } finally {
        setManualSaving(false);
      }
    },
    [editingManualId, loadManualInvestments, resetManualForm, setToast]
  );

  const manualPropertyPayload = useCallback((): ManualAssetRequest | null => {
    const name = manualPropertyForm.name.trim();
    const balance = Number(manualPropertyForm.balance_current);

    if (!name || !Number.isFinite(balance) || balance < 0) {
      setManualPropertyError('Enter an account name and non-negative balance.');
      return null;
    }

    return {
      institution_name: getManualPropertyInstitutionName(manualPropertyForm.account_type),
      name,
      account_type: manualPropertyForm.account_type,
      balance_current: balance,
      mask: null,
    };
  }, [manualPropertyForm]);

  const saveManualProperty = useCallback(async () => {
    const payload = manualPropertyPayload();
    if (!payload) return;

    setManualPropertySaving(true);
    setManualPropertyError(null);
    try {
      if (editingManualPropertyId) {
        await ManualAssetService.update(editingManualPropertyId, payload);
        setToast('Manual asset updated');
      } else {
        await ManualAssetService.create(payload);
        setToast(payload.account_type === 'loan' ? 'Manual liability added' : 'Manual asset added');
      }
      resetManualPropertyForm();
      await loadManualInvestments();
      dispatchAccountsChanged();
    } catch (err) {
      console.warn('Failed to save manual asset', err);
      setManualPropertyError('Could not save this manual asset.');
    } finally {
      setManualPropertySaving(false);
    }
  }, [
    editingManualPropertyId,
    loadManualInvestments,
    manualPropertyPayload,
    resetManualPropertyForm,
    setToast,
  ]);

  const editManualProperty = useCallback((account: Account) => {
    setEditingManualPropertyId(account.id);
    setManualPropertyError(null);
    setManualPropertyForm({
      name: account.name,
      account_type: account.account_type === 'loan' ? 'loan' : 'property',
      balance_current: String(parseAccountBalance(account.balance_current)),
    });
  }, []);

  const deleteManualProperty = useCallback(
    async (account: Account) => {
      setManualPropertySaving(true);
      setManualPropertyError(null);
      try {
        await ManualAssetService.delete(account.id);
        setToast(
          account.account_type === 'loan' ? 'Manual liability removed' : 'Manual asset removed'
        );
        if (editingManualPropertyId === account.id) {
          resetManualPropertyForm();
        }
        await loadManualInvestments();
        dispatchAccountsChanged();
      } catch (err) {
        console.warn('Failed to delete manual asset', err);
        setManualPropertyError('Could not remove this manual asset.');
      } finally {
        setManualPropertySaving(false);
      }
    },
    [editingManualPropertyId, loadManualInvestments, resetManualPropertyForm, setToast]
  );

  const banks = useMemo(
    () =>
      (connections || []).map((conn) => ({
        id: conn.connectionId,
        name: conn.institutionName,
        short: conn.institutionName
          .split(' ')
          .map((word) => word[0])
          .join('')
          .slice(0, 2)
          .toUpperCase(),
        status: conn.isConnected ? ('connected' as const) : ('error' as const),
        lastSync: conn.lastSyncAt,
        accounts: conn.accounts,
      })),
    [connections]
  );

  const summary = useMemo(() => {
    let connectedInstitutions = 0;
    let totalAccounts = 0;
    let latestSyncIso: string | null = null;
    let latestSyncTime = 0;

    for (const bank of banks) {
      if (bank.status === 'connected') connectedInstitutions += 1;
      totalAccounts += bank.accounts.length;

      if (bank.lastSync) {
        const parsed = Date.parse(bank.lastSync);
        if (!Number.isNaN(parsed) && parsed > latestSyncTime) {
          latestSyncTime = parsed;
          latestSyncIso = bank.lastSync;
        }
      }
    }

    return {
      institutions: banks.length,
      connectedInstitutions,
      accounts: totalAccounts + manualInvestments.length + manualPropertyAccounts.length,
      latestSync: latestSyncIso,
    };
  }, [banks, manualInvestments.length, manualPropertyAccounts.length]);

  if (providerLoading) {
    return (
      <section
        className={cn(
          'relative',
          'overflow-hidden',
          'rounded-[2.25rem]',
          'border',
          'border-white/35',
          'bg-white/24',
          'p-12',
          'text-center',
          'shadow-[0_32px_110px_-60px_rgba(15,23,42,0.75)]',
          'backdrop-blur-[28px]',
          'dark:border-white/12',
          'dark:bg-[#0f172a]/55',
          'dark:shadow-[0_36px_120px_-62px_rgba(2,6,23,0.85)]'
        )}
      >
        <div className={cn('text-sm', 'font-medium', 'text-slate-600', 'dark:text-slate-300')}>
          Loading provider catalogue…
        </div>
      </section>
    );
  }

  if (providerError) {
    return (
      <section
        className={cn(
          'relative',
          'overflow-hidden',
          'rounded-[2.25rem]',
          'border',
          'border-red-200/70',
          'bg-red-50/80',
          'p-12',
          'text-center',
          'shadow-[0_32px_110px_-60px_rgba(220,38,38,0.45)]',
          'backdrop-blur-[28px]',
          'dark:border-red-700/60',
          'dark:bg-red-900/25'
        )}
      >
        <div className={cn('text-sm', 'font-semibold', 'text-red-600', 'dark:text-red-300')}>
          {providerError}
        </div>
        <div className={cn('mt-2', 'text-xs', 'text-red-500', 'dark:text-red-200')}>
          Please refresh or try again later.
        </div>
      </section>
    );
  }

  if (!selectedProvider) {
    return (
      <section
        className={cn(
          'relative',
          'overflow-hidden',
          'rounded-[2.25rem]',
          'border',
          'border-white/35',
          'bg-white/24',
          'p-10',
          'shadow-[0_32px_110px_-60px_rgba(15,23,42,0.75)]',
          'backdrop-blur-[28px]',
          'dark:border-white/12',
          'dark:bg-[#0f172a]/55',
          'dark:shadow-[0_36px_120px_-62px_rgba(2,6,23,0.85)]'
        )}
      >
        <div className={cn('relative', 'z-10', 'flex', 'flex-col', 'gap-8')}>
          <div className={cn('space-y-3', 'text-center')}>
            <span
              className={cn(
                'inline-flex',
                'items-center',
                'justify-center',
                'rounded-full',
                'bg-white/75',
                'px-3',
                'py-1',
                'text-[11px]',
                'font-semibold',
                'uppercase',
                'tracking-[0.32em]',
                'text-[#475569]',
                'shadow-[0_16px_42px_-30px_rgba(15,23,42,0.45)]',
                'dark:bg-[#1e293b]/75',
                'dark:text-[#cbd5e1]'
              )}
            >
              Select Provider
            </span>
            <h1
              className={cn(
                'text-3xl',
                'font-bold',
                'text-slate-900',
                'dark:text-white',
                'sm:text-4xl'
              )}
            >
              Choose how you connect accounts
            </h1>
            <p className={cn('text-sm', 'text-slate-600', 'dark:text-slate-300')}>
              Pick the data provider that matches your deployment. You can change this later from
              account settings.
            </p>
          </div>

          <div className={cn('grid', 'gap-6', 'lg:grid-cols-2')}>
            {providerInfo.availableProviders
              .filter((provider) => provider === 'plaid')
              .map((provider) => {
                const details = getProviderCardConfig(provider);
                return (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => handleProviderSelect(provider)}
                    disabled={selectingProvider === provider}
                    className={cn(
                      'relative',
                      'flex',
                      'h-full',
                      'flex-col',
                      'gap-4',
                      'rounded-[1.75rem]',
                      'border',
                      'border-white/45',
                      'bg-white/80',
                      'p-6',
                      'text-left',
                      'transition-all',
                      'duration-200',
                      'hover:-translate-y-[2px]',
                      'hover:shadow-[0_24px_80px_-50px_rgba(15,23,42,0.55)]',
                      'focus:outline-none',
                      'focus-visible:ring-2',
                      'focus-visible:ring-sky-400/80',
                      'focus-visible:ring-offset-2',
                      'focus-visible:ring-offset-white',
                      'disabled:cursor-not-allowed',
                      'disabled:opacity-75',
                      'dark:border-white/10',
                      'dark:bg-[#111a2f]/85',
                      'dark:hover:border-sky-400/40',
                      'dark:hover:shadow-[0_28px_90px_-60px_rgba(2,6,23,0.7)]',
                      'dark:focus-visible:ring-offset-[#0f172a]'
                    )}
                  >
                    <div className={cn('flex', 'items-center', 'justify-between')}>
                      <div
                        className={cn(
                          'text-lg',
                          'font-semibold',
                          'text-slate-900',
                          'dark:text-white'
                        )}
                      >
                        {details.title}
                      </div>
                      <span
                        className={cn(
                          'rounded-full',
                          'bg-sky-100',
                          'px-3',
                          'py-1',
                          'text-[10px]',
                          'font-semibold',
                          'uppercase',
                          'tracking-[0.28em]',
                          'text-sky-700',
                          'dark:bg-sky-500/15',
                          'dark:text-sky-200'
                        )}
                      >
                        {details.badge}
                      </span>
                    </div>
                    <p className={cn('text-sm', 'text-slate-600', 'dark:text-slate-300')}>
                      {details.description}
                    </p>
                    <ul
                      className={cn(
                        'space-y-2',
                        'text-sm',
                        'text-slate-500',
                        'dark:text-slate-400'
                      )}
                    >
                      {details.bullets.map((bullet) => (
                        <li key={bullet} className={cn('flex', 'items-start', 'gap-2')}>
                          <span
                            className={cn(
                              'mt-[5px]',
                              'h-1.5',
                              'w-1.5',
                              'rounded-full',
                              'bg-sky-400',
                              'dark:bg-sky-500'
                            )}
                          />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                    <div
                      className={cn(
                        'mt-auto',
                        'inline-flex',
                        'items-center',
                        'justify-center',
                        'rounded-full',
                        'bg-sky-500',
                        'px-4',
                        'py-2',
                        'text-sm',
                        'font-semibold',
                        'text-white',
                        'shadow-[0_18px_48px_-32px_rgba(14,165,233,0.65)]'
                      )}
                    >
                      {selectingProvider === provider ? 'Selecting…' : `Use ${details.title}`}
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      </section>
    );
  }

  const providerCardConfig = getProviderCardConfig(selectedProvider);
  const providerLabel = providerCardConfig.title;
  const providerDescription =
    selectedProvider === 'plaid'
      ? 'Securely connect institutions with Plaid. Your credentials never touch Sumurai and you can revoke access at any time.'
      : 'Launch Teller Connect to link accounts using your own Teller credentials. Connections stay in your control and can be revoked instantly.';

  const syncFooter =
    selectedProvider === 'plaid'
      ? 'Plaid keeps credentials read-only and disconnectable anytime.'
      : 'Teller connections respect your API keys and can be rotated from your Teller dashboard.';

  // Loading/syncing existing connections must not block opening Plaid Link.
  // Those refreshes run automatically on page load and previously made clicks
  // appear to do nothing while the launch button was silently disabled.
  const connectDisabled = selectingProvider !== null;

  const hasConnections = summary.institutions > 0;
  const lastSyncValue = syncingAll
    ? 'Syncing...'
    : flowLoading
      ? 'Loading...'
      : summary.latestSync
        ? formatRelativeTime(summary.latestSync)
        : 'Awaiting first sync';
  const lastSyncDetail = summary.latestSync
    ? `Refreshed ${formatAbsoluteTime(summary.latestSync)}`
    : syncFooter;

  const syncButtonClasses =
    'inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/85 px-5 py-2 text-sm font-semibold text-[#0f172a] shadow-[0_18px_48px_-32px_rgba(15,23,42,0.45)] transition-all duration-200 hover:-translate-y-[1px] hover:border-[#93c5fd] hover:text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ea5e9] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none dark:border-[#334155] dark:bg-[#1e293b]/90 dark:text-[#cbd5e1] dark:hover:border-[#38bdf8] dark:hover:text-white dark:focus-visible:ring-offset-slate-900';
  const connectButtonClasses =
    'inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0ea5e9] via-[#38bdf8] to-[#a78bfa] px-5 py-2 text-sm font-semibold whitespace-nowrap text-white shadow-[0_22px_60px_-32px_rgba(14,165,233,0.78)] transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_28px_70px_-35px_rgba(14,165,233,0.85)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none dark:shadow-[0_22px_60px_-32px_rgba(56,189,248,0.65)] dark:focus-visible:ring-offset-slate-900';
  const pendingInstitutions = Math.max(0, summary.institutions - summary.connectedInstitutions);

  const actions = (
    <>
      {hasConnections && (
        <button
          type="button"
          onClick={syncAll}
          disabled={syncingAll || flowLoading}
          className={syncButtonClasses}
        >
          <RefreshCw className={`h-4 w-4 ${syncingAll ? 'animate-spin' : ''}`} />
          {syncingAll ? 'Syncing...' : 'Sync all'}
        </button>
      )}
      <button
        type="button"
        onClick={() => void handleConnectProvider('plaid')}
        disabled={connectDisabled}
        className={connectButtonClasses}
      >
        <Plus className={cn('h-4', 'w-4')} />
        <span>Launch Plaid Link</span>
      </button>
    </>
  );

  const statsGrid = (
    <div className={cn('grid', 'gap-3', 'sm:grid-cols-3')}>
      {flowError && (
        <div
          className={cn(
            'sm:col-span-3',
            'rounded-2xl',
            'border',
            'border-red-200/70',
            'bg-red-50/80',
            'px-5',
            'py-3',
            'text-left',
            'shadow-sm',
            'dark:border-red-700/60',
            'dark:bg-red-900/25'
          )}
        >
          <div className={cn('text-sm', 'font-medium', 'text-red-600', 'dark:text-red-300')}>
            {flowError}
          </div>
        </div>
      )}

      <HeroStatCard
        index={1}
        title="Active institutions"
        icon={<Building2 className={cn('h-4', 'w-4')} />}
        value={hasConnections ? summary.connectedInstitutions : 0}
        suffix={`out of ${summary.institutions}`}
        subtext={
          hasConnections
            ? summary.connectedInstitutions === summary.institutions
              ? 'All connections healthy'
              : `${pendingInstitutions} ${pendingInstitutions === 1 ? 'needs' : 'need'} attention`
            : 'Link your first institution'
        }
      />

      <HeroStatCard
        index={2}
        title="Accounts tracked"
        icon={<CreditCard className={cn('h-4', 'w-4')} />}
        value={summary.accounts}
        suffix={summary.accounts === 1 ? 'account' : 'accounts'}
        subtext={
          summary.accounts ? 'Balances stay in sync automatically' : 'Connect to start syncing'
        }
      />

      <HeroStatCard
        index={3}
        title="Last sync"
        icon={<Clock className={cn('h-4', 'w-4')} />}
        value={lastSyncValue}
        subtext={syncingAll ? 'Sync in progress' : lastSyncDetail}
      />
    </div>
  );

  const manualInvestmentsTotal = manualInvestments.reduce(
    (sum, account) => sum + parseAccountBalance(account.balance_current),
    0
  );
  const manualNativeToUsdRate = Number(manualForm.conversion_rate || '1');
  const manualConvertedUsd =
    Number.isFinite(Number(manualForm.balance_current)) && Number.isFinite(manualNativeToUsdRate)
      ? Number(manualForm.balance_current) * manualNativeToUsdRate
      : 0;
  const manualPropertyAssetsTotal = manualPropertyAccounts
    .filter((account) => account.account_type !== 'loan')
    .reduce((sum, account) => sum + parseAccountBalance(account.balance_current), 0);
  const manualPropertyLoansTotal = manualPropertyAccounts
    .filter((account) => account.account_type === 'loan')
    .reduce((sum, account) => sum + parseAccountBalance(account.balance_current), 0);
  const manualHomeEquity = manualPropertyAssetsTotal - manualPropertyLoansTotal;

  const manualInvestmentsSection = (
    <section className={cn('space-y-4')}>
      <div className={cn('flex', 'items-center', 'justify-between', 'gap-3')}>
        <div>
          <h2 className={cn('text-lg', 'font-semibold', 'text-slate-900', 'dark:text-white')}>
            Manual investments
          </h2>
          <div className={cn('text-sm', 'text-slate-600', 'dark:text-slate-300')}>
            {manualInvestments.length
              ? `${manualInvestments.length} account${manualInvestments.length === 1 ? '' : 's'} tracked`
              : 'Track brokerage, IRA, 401k, and foreign balances manually'}
          </div>
        </div>
        <div
          className={cn(
            'text-right',
            'text-sm',
            'font-semibold',
            'text-cyan-600',
            'dark:text-cyan-300'
          )}
        >
          {format(manualInvestmentsTotal)}
        </div>
      </div>

      <GlassCard variant="accent" rounded="xl" padding="lg" withInnerEffects={false}>
        <div
          className={cn('grid', 'gap-3', 'md:grid-cols-[1.15fr_1.15fr_0.85fr_0.75fr_0.85fr_auto]')}
        >
          <Input
            value={manualForm.institution_name}
            onChange={(event) =>
              setManualForm((prev) => ({ ...prev, institution_name: event.target.value }))
            }
            placeholder="Institution"
            variant="glass"
          />
          <Input
            value={manualForm.name}
            onChange={(event) => setManualForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Account name"
            variant="glass"
          />
          <Input
            value={manualForm.balance_current}
            onChange={(event) =>
              setManualForm((prev) => ({ ...prev, balance_current: event.target.value }))
            }
            placeholder="Balance"
            inputMode="decimal"
            variant="glass"
          />
          <select
            value={manualForm.currency}
            onChange={(event) =>
              setManualForm((prev) => ({
                ...prev,
                currency: event.target.value as DisplayCurrency,
              }))
            }
            className={cn(
              'rounded-xl border px-3 py-2 text-sm',
              'border-white/40 bg-white/60 text-slate-900 shadow-inner',
              'focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/30',
              'dark:border-slate-700/70 dark:bg-slate-900/50 dark:text-slate-100'
            )}
            aria-label="Investment currency"
          >
            {SUPPORTED_DISPLAY_CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
          <Input
            value={manualForm.mask}
            onChange={(event) => setManualForm((prev) => ({ ...prev, mask: event.target.value }))}
            placeholder="Label"
            variant="glass"
          />
          <div className={cn('flex', 'gap-2')}>
            <Button
              onClick={saveManualInvestment}
              loading={manualSaving}
              disabled={manualRateLoading}
              variant="secondary"
            >
              <Plus className={cn('h-4', 'w-4')} />
              {editingManualId ? 'Update' : 'Add'}
            </Button>
            {editingManualId && (
              <Button onClick={resetManualForm} variant="icon" size="icon" aria-label="Cancel edit">
                <X className={cn('h-4', 'w-4')} />
              </Button>
            )}
          </div>
        </div>
        <div className={cn('mt-3', 'text-xs', 'text-slate-600', 'dark:text-slate-300')}>
          {manualRateLoading
            ? 'Loading currency rate...'
            : manualRateError
              ? manualRateError
              : manualForm.currency === 'USD'
                ? 'Saved as USD.'
                : `Using ${manualForm.currency} rate${manualRateDate ? ` from ${manualRateDate}` : ''}: ${manualForm.balance_current || '0'} ${manualForm.currency} = ${format(manualConvertedUsd)}.`}
        </div>
        {manualError && (
          <div
            className={cn('mt-3', 'text-sm', 'font-medium', 'text-red-600', 'dark:text-red-300')}
          >
            {manualError}
          </div>
        )}
      </GlassCard>

      {manualInvestments.length > 0 && (
        <div className={cn('grid', 'gap-3', 'md:grid-cols-2')}>
          {manualInvestments.map((account) => (
            <GlassCard
              key={account.id}
              variant="accent"
              rounded="xl"
              padding="lg"
              withInnerEffects={false}
            >
              <div className={cn('flex', 'items-start', 'justify-between', 'gap-3')}>
                <div>
                  <div
                    className={cn('text-sm', 'font-semibold', 'text-slate-900', 'dark:text-white')}
                  >
                    {formatManualInvestmentTitle(account)}
                  </div>
                  <div className={cn('mt-1', 'text-xs', 'text-slate-600', 'dark:text-slate-300')}>
                    {formatManualInvestmentDetail(account)}
                    {account.mask ? ` • ${account.mask}` : ''}
                  </div>
                  {account.updated_at && (
                    <div
                      className={cn(
                        'mt-2',
                        'flex',
                        'items-center',
                        'gap-1.5',
                        'text-xs',
                        'text-slate-500',
                        'dark:text-slate-400'
                      )}
                      title={`Updated ${formatAbsoluteTime(account.updated_at)}`}
                    >
                      <Clock className={cn('h-3.5', 'w-3.5')} />
                      <span>Updated {formatRelativeTime(account.updated_at)}</span>
                    </div>
                  )}
                </div>
                <div className={cn('text-right')}>
                  <div
                    className={cn(
                      'text-sm',
                      'font-semibold',
                      'text-cyan-600',
                      'dark:text-cyan-300'
                    )}
                  >
                    {format(parseAccountBalance(account.balance_current))}
                  </div>
                  <div className={cn('mt-3', 'flex', 'justify-end', 'gap-2')}>
                    <Button
                      onClick={() => editManualInvestment(account)}
                      variant="icon"
                      size="icon"
                      aria-label={`Edit ${formatManualInvestmentTitle(account)}`}
                    >
                      <Pencil className={cn('h-4', 'w-4')} />
                    </Button>
                    <Button
                      onClick={() => deleteManualInvestment(account)}
                      variant="icon"
                      size="icon"
                      aria-label={`Delete ${formatManualInvestmentTitle(account)}`}
                    >
                      <Trash2 className={cn('h-4', 'w-4')} />
                    </Button>
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </section>
  );

  const manualPropertySection = (
    <section className={cn('space-y-4')}>
      <div className={cn('flex', 'items-center', 'justify-between', 'gap-3')}>
        <div>
          <h2 className={cn('text-lg', 'font-semibold', 'text-slate-900', 'dark:text-white')}>
            Manual property
          </h2>
          <div className={cn('text-sm', 'text-slate-600', 'dark:text-slate-300')}>
            {manualPropertyAccounts.length
              ? `${manualPropertyAccounts.length} asset${manualPropertyAccounts.length === 1 ? '' : 's'} tracked`
              : 'Track home value and mortgage principal manually'}
          </div>
        </div>
        <div className={cn('text-right')}>
          <div className={cn('text-sm', 'font-semibold', 'text-teal-600', 'dark:text-teal-300')}>
            {format(manualHomeEquity)}
          </div>
          <div className={cn('text-xs', 'text-slate-500', 'dark:text-slate-400')}>equity</div>
        </div>
      </div>

      <GlassCard variant="accent" rounded="xl" padding="lg" withInnerEffects={false}>
        <div className={cn('grid', 'gap-3', 'md:grid-cols-[0.9fr_1.4fr_1fr_auto]')}>
          <select
            value={manualPropertyForm.account_type}
            onChange={(event) =>
              setManualPropertyForm((prev) => ({
                ...prev,
                account_type: event.target.value as ManualAssetAccountType,
                name: event.target.value === 'loan' ? 'Primary Mortgage' : prev.name,
              }))
            }
            className={cn(
              'rounded-xl border px-3 py-2 text-sm',
              'border-white/40 bg-white/60 text-slate-900 shadow-inner',
              'focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/30',
              'dark:border-slate-700/70 dark:bg-slate-900/50 dark:text-slate-100'
            )}
          >
            <option value="property">Property</option>
            <option value="loan">Mortgage</option>
          </select>
          <Input
            value={manualPropertyForm.name}
            onChange={(event) =>
              setManualPropertyForm((prev) => ({ ...prev, name: event.target.value }))
            }
            placeholder="Account name"
            variant="glass"
          />
          <Input
            value={manualPropertyForm.balance_current}
            onChange={(event) =>
              setManualPropertyForm((prev) => ({ ...prev, balance_current: event.target.value }))
            }
            placeholder="Balance"
            inputMode="decimal"
            variant="glass"
          />
          <div className={cn('flex', 'gap-2')}>
            <Button onClick={saveManualProperty} loading={manualPropertySaving} variant="secondary">
              <Plus className={cn('h-4', 'w-4')} />
              {editingManualPropertyId ? 'Update' : 'Add'}
            </Button>
            {editingManualPropertyId && (
              <Button
                onClick={resetManualPropertyForm}
                variant="icon"
                size="icon"
                aria-label="Cancel edit"
              >
                <X className={cn('h-4', 'w-4')} />
              </Button>
            )}
          </div>
        </div>
        {manualPropertyError && (
          <div
            className={cn('mt-3', 'text-sm', 'font-medium', 'text-red-600', 'dark:text-red-300')}
          >
            {manualPropertyError}
          </div>
        )}
      </GlassCard>

      {manualPropertyAccounts.length > 0 && (
        <div className={cn('grid', 'gap-3', 'md:grid-cols-2')}>
          {manualPropertyAccounts.map((account) => (
            <GlassCard
              key={account.id}
              variant="accent"
              rounded="xl"
              padding="lg"
              withInnerEffects={false}
            >
              <div className={cn('flex', 'items-start', 'justify-between', 'gap-3')}>
                <div>
                  <div className={cn('flex', 'items-center', 'gap-2')}>
                    <Home className={cn('h-4', 'w-4', 'text-teal-500')} />
                    <div
                      className={cn(
                        'text-sm',
                        'font-semibold',
                        'text-slate-900',
                        'dark:text-white'
                      )}
                    >
                      {account.name}
                    </div>
                  </div>
                  <div className={cn('mt-1', 'text-xs', 'text-slate-600', 'dark:text-slate-300')}>
                    {account.account_type === 'loan' ? 'Mortgage' : 'Property'}
                  </div>
                  {account.updated_at && (
                    <div
                      className={cn(
                        'mt-2',
                        'flex',
                        'items-center',
                        'gap-1.5',
                        'text-xs',
                        'text-slate-500',
                        'dark:text-slate-400'
                      )}
                      title={`Updated ${formatAbsoluteTime(account.updated_at)}`}
                    >
                      <Clock className={cn('h-3.5', 'w-3.5')} />
                      <span>Updated {formatRelativeTime(account.updated_at)}</span>
                    </div>
                  )}
                </div>
                <div className={cn('text-right')}>
                  <div
                    className={cn(
                      'text-sm',
                      'font-semibold',
                      account.account_type === 'loan'
                        ? 'text-amber-600 dark:text-amber-300'
                        : 'text-teal-600 dark:text-teal-300'
                    )}
                  >
                    {format(parseAccountBalance(account.balance_current))}
                  </div>
                  <div className={cn('mt-3', 'flex', 'justify-end', 'gap-2')}>
                    <Button
                      onClick={() => editManualProperty(account)}
                      variant="icon"
                      size="icon"
                      aria-label={`Edit ${account.name}`}
                    >
                      <Pencil className={cn('h-4', 'w-4')} />
                    </Button>
                    <Button
                      onClick={() => deleteManualProperty(account)}
                      variant="icon"
                      size="icon"
                      aria-label={`Delete ${account.name}`}
                    >
                      <Trash2 className={cn('h-4', 'w-4')} />
                    </Button>
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div data-testid="accounts-page">
      <PageLayout
        badge={`${providerLabel} Accounts`}
        title="Link banks and keep balances current"
        subtitle={providerDescription}
        actions={actions}
        stats={statsGrid}
      >
        {manualPropertySection}

        {manualInvestmentsSection}

        <ConnectionsList
          banks={banks}
          onConnect={() => handleConnectProvider('plaid')}
          onSync={syncOne}
          onDisconnect={disconnect}
          onAccountSelect={onAccountSelect}
        />

        <AnimatePresence>
          {toast && <Toast message={toast} onClose={() => setToast(null)} />}
        </AnimatePresence>
      </PageLayout>
    </div>
  );
};

export default AccountsPage;
