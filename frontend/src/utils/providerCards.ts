import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  CircleDollarSign,
  Eye,
  Fingerprint,
  Landmark,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { FinancialProvider } from '@/types/api';
import { cn } from '@/ui/primitives';
import { status as uiStatusRecipes } from '@/ui/recipes';
import { featurePalettes } from '@/ui/tokens';

export type ProviderCardSection = {
  icon: LucideIcon;
  label: string;
  value: string;
  description?: string;
  privacyDetails?: ProviderPrivacyDetail[];
};

export type ProviderPrivacyDetail = {
  label: string;
  value: string;
};

export type ProviderCardConfig = {
  title: string;
  badge: string;
  region: string;
  sections: ProviderCardSection[];
  privacyHref: string;
  logoSrc?: string;
};

export const PROVIDER_PRICE_ORDER: FinancialProvider[] = ['teller', 'simplefin', 'plaid'];

export const PROVIDER_CARD_CONFIG: Record<FinancialProvider, ProviderCardConfig> = {
  plaid: {
    title: 'Plaid',
    badge: 'Turn Key',
    region: 'US, CA, UK, EU',
    logoSrc: '/plaid.webp',
    privacyHref: 'https://plaid.com/legal/#consumers',
    sections: [
      {
        icon: CircleDollarSign,
        label: 'Cost',
        value: 'Pay/use',
      },
      {
        icon: Building2,
        label: 'Coverage',
        value: '~12,000 Institutions',
      },
      {
        icon: ShieldCheck,
        label: 'Privacy',
        value: 'Broad',
        privacyDetails: [
          {
            label: 'How it connects',
            value: 'Connects through Plaid Link for a live account feed.',
          },
          {
            label: 'What it stores',
            value: "Keeps up to 24 months of history on Plaid's servers.",
          },
          {
            label: 'How it uses data',
            value: 'Does not sell data, but may share some with affiliates for risk checks.',
          },
          {
            label: 'How to disconnect',
            value: 'Stops syncing; full deletion requires the Plaid Portal.',
          },
        ],
      },
    ],
  },
  teller: {
    title: 'Teller',
    badge: 'Budget Friendly',
    region: 'US Only',
    logoSrc: '/teller.webp',
    privacyHref: 'https://teller.io/legal',
    sections: [
      {
        icon: CircleDollarSign,
        label: 'Cost',
        value: 'Free',
      },
      {
        icon: Building2,
        label: 'Coverage',
        value: '~7,000 Institutions',
      },
      {
        icon: ShieldCheck,
        label: 'Privacy',
        value: 'Moderate',
        privacyDetails: [
          {
            label: 'How it connects',
            value: 'Uses your bank login to connect your accounts.',
          },
          {
            label: 'What it stores',
            value: 'May collect login, account, and transaction data.',
          },
          {
            label: 'How it uses data',
            value: 'Does not sell or license your data.',
          },
          {
            label: 'How to disconnect',
            value: 'Stops access; deleting data may require a request.',
          },
        ],
      },
    ],
  },
  simplefin: {
    title: 'SimpleFIN',
    badge: 'Privacy First',
    region: 'US, CA',
    logoSrc: '/simplefin.webp',
    privacyHref: 'https://beta-bridge.simplefin.org/info/privacy',
    sections: [
      {
        icon: CircleDollarSign,
        label: 'Cost',
        value: '$1.50/mo',
      },
      {
        icon: Building2,
        label: 'Coverage',
        value: '~16,000 Institutions',
      },
      {
        icon: ShieldCheck,
        label: 'Privacy',
        value: 'Strongest',
        privacyDetails: [
          {
            label: 'How it connects',
            value: 'Connects through SimpleFIN and MX.',
          },
          {
            label: 'What it stores',
            value: 'Uses a bridge that routes your data and does not store it.',
          },
          {
            label: 'How it uses data',
            value: 'Does not sell, license, or use your data for AI training.',
          },
          {
            label: 'How to disconnect',
            value: 'Deletes your setup right away.',
          },
        ],
      },
    ],
  },
};

export const getProviderCardConfig = (provider: FinancialProvider): ProviderCardConfig =>
  PROVIDER_CARD_CONFIG[provider];

export const getProviderLogoSrc = (provider: FinancialProvider): string | undefined =>
  getProviderCardConfig(provider).logoSrc;

type HighlightPalette = {
  gradient: string;
  ring: string;
  iconLight: string;
  iconDark: string;
  glow: string;
};

type ProviderHighlight = {
  icon: LucideIcon;
  title: string;
  body: string;
  palette: HighlightPalette;
};

type FeaturePalette = {
  gradient: string;
  ring: string;
  icon: string;
  glow: string;
};

type ProviderFeature = {
  icon: LucideIcon;
  title: string;
  body: string;
  palette: FeaturePalette;
};

export interface ConnectAccountProviderContent {
  displayName: string;
  logoSrc?: string;
  eyebrow: {
    text: string;
    backgroundClassName: string;
    textClassName: string;
  };
  heroTitle: string;
  heroDescription: string;
  highlightLabel: string;
  highlightMeta: string;
  features: ProviderFeature[];
  highlights: ProviderHighlight[];
  cta: {
    defaultLabel: string;
    badge?: string;
  };
  securityNote: string;
  requiresApplicationId?: boolean;
  applicationIdMissingCopy?: string;
}

const PLAID_CONNECT_CONTENT: ConnectAccountProviderContent = {
  displayName: 'Plaid',
  logoSrc: '/plaid.webp',
  eyebrow: {
    text: 'Plaid Secure Link',
    backgroundClassName: cn(uiStatusRecipes.success.surface),
    textClassName: cn(uiStatusRecipes.success.text),
  },
  heroTitle: 'Connect your accounts',
  heroDescription:
    'Securely link accounts to unlock live dashboards and automated budgets. Plaid uses industry-standard encryption so your credentials remain private.',
  highlightLabel: "What you'll connect",
  highlightMeta: 'Read-only by design',
  features: [
    {
      icon: Landmark,
      title: 'Global accounts & balances',
      body: 'See your checking, savings, cards, and up-to-date balances in one place.',
      palette: featurePalettes.providerFeature.emerald,
    },
    {
      icon: Zap,
      title: 'Detailed transactions',
      body: 'New purchases and payments appear automatically for accurate budgets.',
      palette: featurePalettes.providerFeature.amber,
    },
    {
      icon: Sparkles,
      title: 'Rich categorizations',
      body: 'Merchants and categories are tidied so reports are easy to understand.',
      palette: featurePalettes.providerFeature.purple,
    },
  ],
  highlights: [
    {
      icon: Building2,
      title: 'Independent linking',
      body: 'Credentials never touch our servers—Plaid brokers every session.',
      palette: featurePalettes.highlight.amber,
    },
    {
      icon: ShieldCheck,
      title: 'Bank-grade protection',
      body: 'The connection is encrypted and identity-verified before any data is shared.',
      palette: featurePalettes.highlight.sky,
    },
    {
      icon: Fingerprint,
      title: 'You stay in control',
      body: 'Disconnect anytime from Settings—data access stops instantly.',
      palette: featurePalettes.highlight.violet,
    },
    {
      icon: Eye,
      title: 'Preview first',
      body: 'Not ready yet? Explore demo insights and link when you are.',
      palette: featurePalettes.highlight.fuchsia,
    },
  ],
  cta: {
    defaultLabel: 'Connect Plaid to an Ally',
    badge: 'Secure',
  },
  securityNote:
    '🔒 Bank-level encryption keeps every credential private. Plaid only shares read-only data, so funds stay untouchable.',
};

const TELLER_CONNECT_CONTENT: ConnectAccountProviderContent = {
  displayName: 'Teller',
  logoSrc: '/teller.webp',
  eyebrow: {
    text: 'Teller Connect',
    backgroundClassName: cn(uiStatusRecipes.info.surface),
    textClassName: cn(uiStatusRecipes.info.text),
  },
  heroTitle: 'Connect your accounts',
  heroDescription:
    'Teller uses your own API keys to sync accounts without handing off long-lived credentials. Keep full control while budgets stay real-time.',
  highlightLabel: "What you'll connect",
  highlightMeta: 'Read-only access',
  features: [
    {
      icon: Landmark,
      title: 'US Accounts & balances',
      body: 'See your checking, savings, cards, and up-to-date balances in one place.',
      palette: featurePalettes.providerFeature.emerald,
    },
    {
      icon: Zap,
      title: 'Recent transactions',
      body: 'New purchases and payments appear automatically for accurate budgets.',
      palette: featurePalettes.providerFeature.amber,
    },
    {
      icon: Sparkles,
      title: 'Clean categories',
      body: 'Merchants and categories are tidied so reports are easy to understand.',
      palette: featurePalettes.providerFeature.purple,
    },
  ],
  highlights: [
    {
      icon: Eye,
      title: 'Read-only by design',
      body: "We can't move money or make changes—only view balances and transactions.",
      palette: featurePalettes.highlight.sky,
    },
    {
      icon: Fingerprint,
      title: "You're in control",
      body: 'Disconnect anytime from settings; access stops immediately.',
      palette: featurePalettes.highlight.violet,
    },
    {
      icon: ShieldCheck,
      title: 'Bank-grade protection',
      body: 'The connection is encrypted and identity-verified before any data is shared.',
      palette: featurePalettes.highlight.emerald,
    },
    {
      icon: Building2,
      title: 'Fully transparent',
      body: 'Every sync is logged so you can see what was accessed and when.',
      palette: featurePalettes.highlight.amber,
    },
  ],
  cta: {
    defaultLabel: 'Connect Teller to an Ally',
    badge: 'mTLS',
  },
  securityNote: '🔒 Industry-grade security standards and connections. Disconnect anytime.',
  requiresApplicationId: true,
  applicationIdMissingCopy:
    'Teller onboarding requires a Teller application ID. Add it in provider settings before connecting.',
};

const SIMPLEFIN_CONNECT_CONTENT: ConnectAccountProviderContent = {
  displayName: 'SimpleFIN',
  logoSrc: '/simplefin.webp',
  eyebrow: {
    text: 'SimpleFIN Bridge',
    backgroundClassName: cn(uiStatusRecipes.info.surface),
    textClassName: cn(uiStatusRecipes.info.text),
  },
  heroTitle: 'Connect your SimpleFIN bridge',
  heroDescription:
    'Paste a one-time SimpleFIN setup token to connect the institutions you authorize on the bridge.',
  highlightLabel: "What you'll connect",
  highlightMeta: 'Read-only access',
  features: [
    {
      icon: Landmark,
      title: 'Many institutions',
      body: 'One bridge can link every bank you enable on SimpleFIN.',
      palette: featurePalettes.providerFeature.emerald,
    },
    {
      icon: Zap,
      title: 'No embedded link UI',
      body: 'Sumurai stays out of the way—connect uses your pasted setup token and stored bridge access.',
      palette: featurePalettes.providerFeature.amber,
    },
    {
      icon: Sparkles,
      title: 'You hold the keys',
      body: 'Manage access at simplefin.org; revoke or rotate tokens whenever you need.',
      palette: featurePalettes.providerFeature.purple,
    },
  ],
  highlights: [
    {
      icon: Eye,
      title: 'Read-only by design',
      body: "We can't move money or make changes—only view balances and transactions.",
      palette: featurePalettes.highlight.sky,
    },
    {
      icon: Fingerprint,
      title: "You're in control",
      body: 'Disconnect individual institutions without removing bridge access for the rest.',
      palette: featurePalettes.highlight.violet,
    },
    {
      icon: Building2,
      title: 'Bridge-backed sync',
      body: 'Balances and transactions flow through your SimpleFIN bridge credentials.',
      palette: featurePalettes.highlight.amber,
    },
    {
      icon: ShieldCheck,
      title: 'Transparent access',
      body: 'Every sync is scoped to institutions you explicitly linked on the bridge.',
      palette: featurePalettes.highlight.emerald,
    },
  ],
  cta: {
    defaultLabel: 'Connect SimpleFIN to an Ally',
    badge: 'Bridge',
  },
  securityNote: 'Disconnect individual institutions anytime without removing your bridge access.',
};

export const CONNECT_ACCOUNT_PROVIDER_CONTENT: Record<
  FinancialProvider,
  ConnectAccountProviderContent
> = {
  plaid: PLAID_CONNECT_CONTENT,
  teller: TELLER_CONNECT_CONTENT,
  simplefin: SIMPLEFIN_CONNECT_CONTENT,
};

export const getConnectAccountProviderContent = (
  provider: FinancialProvider
): ConnectAccountProviderContent => CONNECT_ACCOUNT_PROVIDER_CONTENT[provider];
