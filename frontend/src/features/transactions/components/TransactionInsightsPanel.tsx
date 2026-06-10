import { Activity, BarChart3, Layers } from 'lucide-react';
import { useState } from 'react';
import { InsightCard } from '@/components/widgets/InsightCard';
import { InsightsPanel } from '@/components/widgets/InsightsPanel';
import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';
import type { ContextualInsightsResponse, InsightMetric, InsightState } from '@/types/api';
import { cn } from '@/ui/primitives';
import { text as semanticTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
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

function fmtPctExact(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function fmtDays(v: number): string {
  const d = Math.round(v);
  return d === 1 ? '1 day' : `${d} days`;
}

function signedInsightAmount(value: number): number {
  const signed = -value;
  return signed === 0 ? 0 : signed;
}

function insightAmountClassName(signed: number): string {
  if (signed < 0) {
    return semanticTextRecipes.danger;
  }
  if (signed > 0) {
    return semanticTextRecipes.success;
  }
  return semanticTextRecipes.muted;
}

function InsightCurrency({ value, className }: { value: number; className?: string }) {
  const signed = signedInsightAmount(value);
  return (
    <span className={cn('justify-self-start', insightAmountClassName(signed), className)}>
      {fmtUSD(signed)}
    </span>
  );
}

function Card1Value({ metric }: { metric: InsightMetric }) {
  const spent = metric.value ?? 0;
  const count = metric.secondary ?? 0;
  return (
    <>
      <InsightCurrency value={spent} />
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
  return <InsightCurrency value={v} className="col-span-3" />;
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
            total
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
            <InsightCurrency value={comparison} />
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
        <span className="justify-self-start">{fmtPctExact(value)}</span>
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
  return <InsightCurrency value={value} className="col-span-3" />;
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

  const state: InsightState = insights?.state ?? 'a';
  const cardAccent = 'emerald' as const;
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
    <InsightsPanel
      testId="transaction-insights-shell"
      accent="emerald"
      headerLabel={stateLabel}
      isLoading={isLoading}
    >
      <InsightCard
        title={copy.card1.title}
        icon={<BarChart3 />}
        value={<Card1Value metric={card1} />}
        suffix={card1ShareSuffix}
        question={copy.card1.question}
        accent={cardAccent}
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
        accent={cardAccent}
        flipped={!!flipped.card2}
        onToggle={() => toggle('card2')}
        outlined={false}
        tileLayout={!isMobile}
        tileAlign="center"
        subgridRow={isMobile}
      />
      {card3 != null ? (
        <InsightCard
          title={copy.card3.title}
          icon={<Layers />}
          value={<Card3Value metric={card3} />}
          question={copy.card3.question}
          accent={cardAccent}
          flipped={!!flipped.card3}
          onToggle={() => toggle('card3')}
          outlined={false}
          tileLayout={!isMobile}
          tileAlign="end"
          subgridRow={isMobile}
        />
      ) : null}
    </InsightsPanel>
  );
}
