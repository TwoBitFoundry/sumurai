import type { FinancialProvider } from '@/types/api'
import type { LucideIcon } from 'lucide-react'
import {
  Building2,
  Eye,
  Fingerprint,
  Landmark,
  Network,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'

export type ProviderCardConfig = {
  title: string
  badge: string
  description: string
  bullets: string[]
}

export const PROVIDER_CARD_CONFIG: Record<FinancialProvider, ProviderCardConfig> = {
  plaid: {
    title: 'Plaid',
    badge: 'Premium',
    description: 'Enterprise-grade data enrichment with the broadest institution coverage.',
    bullets: [
      'Enhanced categorization with confidence scores',
      '12,000+ supported institutions',
      'Merchant enrichment and location data',
      'Managed compliance under our SaaS offering',
    ],
  },
  teller: {
    title: 'Teller',
    badge: 'Self-hosted friendly',
    description: 'Bring your own Teller credentials for lightweight, developer-first access.',
    bullets: [
      'Unlimited sandbox with 100 free live connections',
      'Direct connections with running balances',
      'Simple category strings that map into your budgets',
      'Ideal for self-hosted deployments',
    ],
  },
}

export const getProviderCardConfig = (provider: FinancialProvider): ProviderCardConfig =>
  PROVIDER_CARD_CONFIG[provider]

type HighlightPalette = {
  gradient: string
  ring: string
  iconLight: string
  iconDark: string
  glow: string
}

type ProviderHighlight = {
  icon: LucideIcon
  title: string
  body: string
  palette: HighlightPalette
}

type FeaturePalette = {
  gradient: string
  ring: string
  iconLight: string
  iconDark: string
  glow: string
}

type ProviderFeature = {
  icon: LucideIcon
  title: string
  body: string
  palette: FeaturePalette
}

export interface ConnectAccountProviderContent {
  displayName: string
  eyebrow: {
    text: string
    backgroundClassName: string
    textClassName: string
  }
  heroTitle: string
  heroDescription: string
  highlightLabel: string
  highlightMeta: string
  features: ProviderFeature[]
  highlights: ProviderHighlight[]
  cta: {
    defaultLabel: string
    badge?: string
  }
  securityNote: string
  requiresApplicationId?: boolean
  applicationIdMissingCopy?: string
}

const PLAID_CONNECT_CONTENT: ConnectAccountProviderContent = {
  displayName: 'Plaid',
  eyebrow: {
    text: 'Plaid Secure Link',
    backgroundClassName: 'bg-[#34d399]/20 dark:bg-[#34d399]/20',
    textClassName: 'text-[#10b981] dark:text-[#34d399]',
  },
  heroTitle: 'Connect your Accounts',
  heroDescription:
    'Securely link accounts to unlock live dashboards and automated budgets. Plaid uses industry-standard encryption so your credentials remain private.',
  highlightLabel: 'Why Plaid?',
  highlightMeta: 'Trusted by 12k+ apps',
  features: [
    {
      icon: ShieldCheck,
      title: 'Secure',
      body: 'Bank-grade encryption and limited access.',
      palette: {
        gradient: 'from-sky-400/55 via-sky-500/25 to-sky-500/5',
        ring: 'ring-sky-300/35',
        iconLight: 'text-sky-700',
        iconDark: 'text-sky-100',
        glow: 'shadow-[0_16px_40px_-24px_rgba(14,165,233,0.55)]',
      },
    },
    {
      icon: Zap,
      title: 'Fast',
      body: 'All accounts synced in a snap.',
      palette: {
        gradient: 'from-amber-400/55 via-amber-500/25 to-amber-500/5',
        ring: 'ring-amber-300/35',
        iconLight: 'text-amber-700',
        iconDark: 'text-amber-100',
        glow: 'shadow-[0_16px_40px_-24px_rgba(245,158,11,0.55)]',
      },
    },
    {
      icon: Landmark,
      title: '11k+ banks',
      body: 'Covering major institutions and credit unions.',
      palette: {
        gradient: 'from-emerald-400/55 via-emerald-500/25 to-emerald-500/5',
        ring: 'ring-emerald-300/35',
        iconLight: 'text-emerald-700',
        iconDark: 'text-emerald-100',
        glow: 'shadow-[0_16px_40px_-24px_rgba(16,185,129,0.55)]',
      },
    },
  ],
  highlights: [
    {
      icon: Building2,
      title: 'Independent linking',
      body: 'Credentials never touch our servers—Plaid brokers every session.',
      palette: {
        gradient: 'from-amber-400/55 via-amber-500/25 to-amber-500/5',
        ring: 'ring-amber-300/35',
        iconLight: 'text-amber-700',
        iconDark: 'text-amber-200',
        glow: 'shadow-[0_18px_45px_-25px_rgba(245,158,11,0.65)]',
      },
    },
    {
      icon: ShieldCheck,
      title: 'Protected access',
      body: 'MFA, device fingerprinting, and tokenization guard each sync.',
      palette: {
        gradient: 'from-sky-400/55 via-sky-500/25 to-sky-500/5',
        ring: 'ring-sky-300/35',
        iconLight: 'text-sky-700',
        iconDark: 'text-sky-200',
        glow: 'shadow-[0_18px_45px_-25px_rgba(14,165,233,0.6)]',
      },
    },
    {
      icon: Fingerprint,
      title: 'You stay in control',
      body: 'Disconnect anytime from Settings—data access stops instantly.',
      palette: {
        gradient: 'from-violet-400/55 via-violet-500/25 to-violet-500/5',
        ring: 'ring-violet-300/35',
        iconLight: 'text-violet-700',
        iconDark: 'text-violet-200',
        glow: 'shadow-[0_18px_45px_-25px_rgba(139,92,246,0.6)]',
      },
    },
    {
      icon: Eye,
      title: 'Preview first',
      body: 'Not ready yet? Explore demo insights and link when you are.',
      palette: {
        gradient: 'from-fuchsia-400/55 via-fuchsia-500/25 to-fuchsia-500/5',
        ring: 'ring-fuchsia-300/35',
        iconLight: 'text-fuchsia-700',
        iconDark: 'text-fuchsia-200',
        glow: 'shadow-[0_18px_45px_-25px_rgba(217,70,239,0.62)]',
      },
    },
  ],
  cta: {
    defaultLabel: 'Connect with Plaid',
    badge: 'Secure',
  },
  securityNote:
    '🔒 Bank-level encryption keeps every credential private. Plaid only shares read-only data, so funds stay untouchable.',
}

const TELLER_CONNECT_CONTENT: ConnectAccountProviderContent = {
  displayName: 'Teller',
  eyebrow: {
    text: 'Teller Connect',
    backgroundClassName: 'bg-[#38bdf8]/20 dark:bg-[#38bdf8]/15',
    textClassName: 'text-[#0284c7] dark:text-[#38bdf8]',
  },
  heroTitle: 'Connect with Teller',
  heroDescription:
    'Launch Teller Connect using your own API keys to sync accounts without handing off long-lived credentials. Keep full control while budgets stay real-time.',
  highlightLabel: 'Why Teller?',
  highlightMeta: 'Bring your own credentials',
  features: [
    {
      icon: ShieldCheck,
      title: 'Mutual TLS',
      body: 'Every session authenticates with mutual TLS so your API keys stay in your infrastructure.',
      palette: {
        gradient: 'from-emerald-400/55 via-emerald-500/25 to-emerald-500/5',
        ring: 'ring-emerald-300/35',
        iconLight: 'text-emerald-700',
        iconDark: 'text-emerald-100',
        glow: 'shadow-[0_16px_40px_-24px_rgba(16,185,129,0.55)]',
      },
    },
    {
      icon: Network,
      title: 'Direct connections',
      body: 'Connect straight to Teller-supported institutions with zero credential sharing.',
      palette: {
        gradient: 'from-sky-400/55 via-sky-500/25 to-sky-500/5',
        ring: 'ring-sky-300/35',
        iconLight: 'text-sky-700',
        iconDark: 'text-sky-100',
        glow: 'shadow-[0_16px_40px_-24px_rgba(14,165,233,0.55)]',
      },
    },
    {
      icon: Sparkles,
      title: 'Developer-first',
      body: 'Predictable REST responses and real-time ledger balances keep automation simple.',
      palette: {
        gradient: 'from-purple-400/55 via-purple-500/25 to-purple-500/5',
        ring: 'ring-purple-300/35',
        iconLight: 'text-purple-700',
        iconDark: 'text-purple-100',
        glow: 'shadow-[0_16px_40px_-24px_rgba(168,85,247,0.55)]',
      },
    },
  ],
  highlights: [
    {
      icon: Building2,
      title: 'Bring your own keys',
      body: 'Operate with Teller application keys so you stay the owner of access and revocation.',
      palette: {
        gradient: 'from-emerald-400/55 via-emerald-500/25 to-emerald-500/5',
        ring: 'ring-emerald-300/35',
        iconLight: 'text-emerald-700',
        iconDark: 'text-emerald-100',
        glow: 'shadow-[0_18px_45px_-25px_rgba(16,185,129,0.55)]',
      },
    },
    {
      icon: Fingerprint,
      title: 'mTLS handshake',
      body: 'Mutual TLS validates every request—credentials never touch third-party systems.',
      palette: {
        gradient: 'from-teal-400/55 via-teal-500/25 to-teal-500/5',
        ring: 'ring-teal-300/35',
        iconLight: 'text-teal-700',
        iconDark: 'text-teal-100',
        glow: 'shadow-[0_18px_45px_-25px_rgba(13,148,136,0.55)]',
      },
    },
    {
      icon: Landmark,
      title: 'Real-time balances',
      body: 'Ledger and available balances are fetched on every sync so dashboards stay accurate.',
      palette: {
        gradient: 'from-sky-400/55 via-sky-500/25 to-sky-500/5',
        ring: 'ring-sky-300/35',
        iconLight: 'text-sky-700',
        iconDark: 'text-sky-200',
        glow: 'shadow-[0_18px_45px_-25px_rgba(14,165,233,0.6)]',
      },
    },
    {
      icon: Eye,
      title: 'Operational visibility',
      body: 'Detailed webhook events and logs keep every sync auditable.',
      palette: {
        gradient: 'from-violet-400/55 via-violet-500/25 to-violet-500/5',
        ring: 'ring-violet-300/35',
        iconLight: 'text-violet-700',
        iconDark: 'text-violet-200',
        glow: 'shadow-[0_18px_45px_-25px_rgba(139,92,246,0.6)]',
      },
    },
  ],
  cta: {
    defaultLabel: 'Launch Teller Connect',
    badge: 'mTLS',
  },
  securityNote:
    '🔒 Teller Connect uses mutual TLS so your API keys remain in your control. Connections stay read-only and can be revoked instantly.',
  requiresApplicationId: true,
  applicationIdMissingCopy:
    'Teller onboarding requires a Teller application ID. Add it in provider settings before connecting.',
}

export const CONNECT_ACCOUNT_PROVIDER_CONTENT: Record<
  FinancialProvider,
  ConnectAccountProviderContent
> = {
  plaid: PLAID_CONNECT_CONTENT,
  teller: TELLER_CONNECT_CONTENT,
}

export const getConnectAccountProviderContent = (
  provider: FinancialProvider,
): ConnectAccountProviderContent => CONNECT_ACCOUNT_PROVIDER_CONTENT[provider]
