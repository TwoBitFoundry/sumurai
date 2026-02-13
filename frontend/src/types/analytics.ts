export type Totals = {
  cash: number;
  credit: number; // negative
  loan: number; // negative
  investments: number;
  positivesTotal: number;
  negativesTotal: number; // negative
  net: number;
  ratio: number | null;
};

export type BalancesOverview = {
  asOf: string;
  overall: Totals;
  banks: (Totals & { bankId: string; bankName: string })[];
  mixedCurrency: boolean;
};
