import { Activity, BarChart3, Layers } from 'lucide-react';
import { type CSSProperties, useState } from 'react';
import { InsightCard } from '@/components/widgets/InsightCard';
import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';
import type { ContextualInsightsResponse, InsightMetric, InsightState } from '@/types/api';
import { cn } from '@/ui/primitives';
import {
  text as semanticTextRecipes,
  border as uiBorderRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { heroAccents } from '@/ui/tokens';
import { fmtUSD } from '../../../utils/format';
import { INSIGHT_COPY } from '../copy/insightCopy';

export interface TransactionInsightsPanelProps {
  insights: ContextualInsightsResponse | null;
  isLoading: boolean;
  resetKey: string;
}

const STATE_LABEL: Record<InsightState, string> = {
  a: 'All transactions',
  b: 'Category filter',
  c: 'Merchant view',
  d: 'This account',
  e: 'Account + Category',
  f: 'Account + Merchant',
  g: 'Category + Merchant',
  triple: 'Full filter',
};

function fmtRatio(v: number): string {
  return `${v.toFixed(1)}×`;
}

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}

function fmtDays(v: number): string {
  const d = Math.round(v);
  return d === 1 ? '1 day' : `${d} days`;
}

function Card1Value({ metric }: { metric: InsightMetric }) {
  const spent = metric.value ?? 0;
  const count = metric.secondary ?? 0;
  return (
    <>
      <span className="justify-self-start">{fmtUSD(spent)}</span>
      <span
        className={cn(
          uiTypographyRecipes.caption,
          semanticTextRecipes.subtle,
          'justify-self-center'
        )}
      >
        /
      </span>
      <span className="justify-self-start">
        {Math.round(count)}
        <span className={cn(uiTypographyRecipes.caption, semanticTextRecipes.body, 'ml-0.5')}>
          tx
        </span>
      </span>
    </>
  );
}

function Card2Value({ metric }: { metric: InsightMetric }) {
  const v = metric.value;
  if (v == null) {
    return <span className="justify-self-start col-span-3">—</span>;
  }
  return <span className="justify-self-start col-span-3">{fmtUSD(v)}</span>;
}

function Card3Value({ metric }: { metric: InsightMetric }) {
  const { value, format, secondary, comparison } = metric;

  if (format === 'count') {
    const fixed = value ?? 0;
    const variable = secondary ?? 0;
    return (
      <>
        <span className="justify-self-start">
          {Math.round(fixed)}
          <span className={cn(uiTypographyRecipes.caption, semanticTextRecipes.body, 'ml-0.5')}>
            fixed
          </span>
        </span>
        <span
          className={cn(
            uiTypographyRecipes.caption,
            semanticTextRecipes.subtle,
            'justify-self-center'
          )}
        >
          /
        </span>
        <span className="justify-self-start">
          {Math.round(variable)}
          <span className={cn(uiTypographyRecipes.caption, semanticTextRecipes.body, 'ml-0.5')}>
            active
          </span>
        </span>
      </>
    );
  }

  if (format === 'ratio') {
    if (value == null) {
      return <span className="justify-self-start col-span-3">—</span>;
    }
    return (
      <>
        <span className="justify-self-start">{fmtRatio(value)}</span>
        {comparison != null ? (
          <>
            <span
              className={cn(
                uiTypographyRecipes.caption,
                semanticTextRecipes.subtle,
                'justify-self-center'
              )}
            >
              vs
            </span>
            <span className="justify-self-start">
              <span className={cn(uiTypographyRecipes.caption, semanticTextRecipes.body)}>
                {fmtUSD(comparison)}
              </span>
            </span>
          </>
        ) : (
          <>
            <span />
            <span />
          </>
        )}
      </>
    );
  }

  if (format === 'percent') {
    if (value == null) {
      return <span className="justify-self-start col-span-3">—</span>;
    }
    return (
      <>
        <span className="justify-self-start">{fmtPct(value)}</span>
        <span />
        <span />
      </>
    );
  }

  if (format === 'days') {
    if (value == null) {
      return <span className="justify-self-start col-span-3">—</span>;
    }
    return (
      <>
        <span className="justify-self-start">{fmtDays(value)}</span>
        <span
          className={cn(
            uiTypographyRecipes.caption,
            semanticTextRecipes.subtle,
            'justify-self-center'
          )}
        >
          ago
        </span>
        <span />
      </>
    );
  }

  if (value == null) {
    return <span className="justify-self-start col-span-3">—</span>;
  }
  return <span className="justify-self-start col-span-3">{fmtUSD(value)}</span>;
}

export function TransactionInsightsPanel({
  insights,
  isLoading,
  resetKey,
}: TransactionInsightsPanelProps) {
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const { isMobile } = useViewportBreakpoint();

  if (lastResetKey !== resetKey) {
    setLastResetKey(resetKey);
    setFlipped({});
  }

  const toggle = (id: string) => setFlipped((prev) => ({ ...prev, [id]: !prev[id] }));
  const shellAccent = heroAccents.sky;

  const state: InsightState = insights?.state ?? 'a';
  const copy = INSIGHT_COPY[state];
  const stateLabel = STATE_LABEL[state];

  const card1 = insights?.card1 ?? {
    value: 0,
    format: 'currency' as const,
    secondary: 0,
    comparison: null,
    share: null,
    label: null,
  };
  const card2 = insights?.card2 ?? {
    value: null,
    format: 'currency' as const,
    secondary: null,
    comparison: null,
    share: null,
    label: null,
  };
  const card3 = insights?.card3 ?? null;

  const card1ShareSuffix =
    card1.share != null ? (
      <span className={cn(uiTypographyRecipes.caption, semanticTextRecipes.subtle)}>
        {fmtPct(card1.share)}
      </span>
    ) : undefined;

  return (
    <section
      data-testid="transaction-insights-shell"
      className={cn(
        'relative',
        'overflow-hidden',
        'rounded-[0.75rem]',
        'border-2',
        shellAccent.border,
        shellAccent.borderDark,
        'bg-white/80',
        'transition-colors',
        'duration-200',
        'dark:bg-[#111a2f]/70'
      )}
    >
      <div
        className={cn(
          'hero-stat-card__gradient',
          'pointer-events-none',
          'absolute',
          'inset-0',
          'rounded-[inherit]',
          'opacity-0',
          'transition-opacity',
          'duration-300',
          'group-hover:opacity-100'
        )}
        style={{
          backgroundImage: `linear-gradient(135deg, ${shellAccent.gradFrom}33, ${shellAccent.gradVia}1f, transparent 70%)`,
        }}
      />
      <div
        className={cn(
          'pointer-events-none',
          'absolute',
          'inset-[2px]',
          'rounded-[calc(0.75rem-2px)]'
        )}
      >
        <div
          className={cn('absolute', 'inset-0', 'rounded-[inherit]', 'ring-2')}
          style={{ '--tw-ring-color': `${shellAccent.ringHex}66` } as CSSProperties}
        />
      </div>

      <div className={cn('relative', 'z-10', 'px-3', 'py-2', 'md:px-4', 'md:py-3')}>
        <div
          className={cn(
            'mb-2',
            'flex',
            'items-center',
            'justify-between',
            'gap-2',
            uiTypographyRecipes.label,
            semanticTextRecipes.subtle
          )}
        >
          <span>{stateLabel}</span>
          {isLoading ? (
            <span className={cn(uiTypographyRecipes.caption, semanticTextRecipes.muted)}>
              Loading…
            </span>
          ) : null}
        </div>
        <div className={cn('border-b', ...uiBorderRecipes.divider, 'mb-2')} />
        <div
          className={cn(
            isMobile
              ? 'grid grid-cols-[auto_1fr_auto_auto_auto] items-baseline gap-x-2 gap-y-1.5'
              : 'flex flex-row items-start gap-3'
          )}
        >
          <InsightCard
            title={copy.card1.title}
            icon={<BarChart3 />}
            value={<Card1Value metric={card1} />}
            suffix={card1ShareSuffix}
            question={copy.card1.question}
            accent="slate"
            flipped={!!flipped.card1}
            onToggle={() => toggle('card1')}
            outlined={false}
            tileLayout={!isMobile}
            subgridRow={isMobile}
          />
          <InsightCard
            title={copy.card2.title}
            icon={<Activity />}
            value={<Card2Value metric={card2} />}
            question={copy.card2.question}
            accent="slate"
            flipped={!!flipped.card2}
            onToggle={() => toggle('card2')}
            outlined={false}
            tileLayout={!isMobile}
            subgridRow={isMobile}
          />
          {card3 != null ? (
            <InsightCard
              title={copy.card3.title}
              icon={<Layers />}
              value={<Card3Value metric={card3} />}
              question={copy.card3.question}
              accent="slate"
              flipped={!!flipped.card3}
              onToggle={() => toggle('card3')}
              outlined={false}
              tileLayout={!isMobile}
              subgridRow={isMobile}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
