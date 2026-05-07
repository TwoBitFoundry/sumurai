export type VisualMatrixGroup =
  | 'primitives'
  | 'features'
  | 'app_shell'
  | 'auth'
  | 'onboarding'
  | 'authenticated_tabs';

export type VisualMatrixEntry = {
  readonly id: string;
  readonly group: VisualMatrixGroup;
  readonly theme: 'light' | 'dark';
  readonly rationale?: string;
};

export const VISUAL_STORYBOOK_MATRIX: readonly VisualMatrixEntry[] = [
  {
    id: 'primitives-button--primary',
    group: 'primitives',
    theme: 'light',
    rationale: 'Primary CTA baseline',
  },
  {
    id: 'primitives-button--disabled',
    group: 'primitives',
    theme: 'light',
    rationale: 'Disabled control contrast',
  },
  {
    id: 'primitives-glasscard--default',
    group: 'primitives',
    theme: 'light',
    rationale: 'Glass surface baseline',
  },
  {
    id: 'primitives-glasscard--dark-canvas',
    group: 'primitives',
    theme: 'dark',
    rationale: 'Glass on dark canvas',
  },
  {
    id: 'primitives-input--invalid',
    group: 'primitives',
    theme: 'light',
    rationale: 'Form error styling',
  },
  {
    id: 'primitives-emptystate--default',
    group: 'primitives',
    theme: 'light',
    rationale: 'Empty surface copy and layout',
  },
  {
    id: 'features-budgets-budgetsummarycard--default',
    group: 'features',
    theme: 'light',
    rationale: 'Budget hero card',
  },
  {
    id: 'features-transactions-transactionstoolbar--default',
    group: 'features',
    theme: 'light',
    rationale: 'Transactions filters and actions',
  },
  {
    id: 'features-analytics-dashboardchartcard--default',
    group: 'features',
    theme: 'light',
    rationale: 'Dashboard chart shell',
  },
  {
    id: 'features-plaid-providerselectionpanel--catalogue',
    group: 'features',
    theme: 'light',
    rationale: 'Provider picker grid',
  },
  {
    id: 'storybook-appchrome--unauthenticated-login',
    group: 'app_shell',
    theme: 'light',
    rationale: 'Marketing gradient + login chrome',
  },
  {
    id: 'storybook-appchrome--unauthenticated-login-dark',
    group: 'app_shell',
    theme: 'dark',
    rationale: 'Unauthenticated shell dark',
  },
  {
    id: 'storybook-appchrome--authenticated-dashboard',
    group: 'app_shell',
    theme: 'light',
    rationale: 'Tab shell placeholder body',
  },
  {
    id: 'storybook-appchrome--authenticated-dashboard-dark',
    group: 'app_shell',
    theme: 'dark',
    rationale: 'Tab shell dark',
  },
  {
    id: 'app-auth--login-default',
    group: 'auth',
    theme: 'light',
    rationale: 'Login form baseline',
  },
  {
    id: 'app-auth--login-default-dark',
    group: 'auth',
    theme: 'dark',
    rationale: 'Login form dark',
  },
  {
    id: 'app-onboarding-welcomestep--default',
    group: 'onboarding',
    theme: 'light',
    rationale: 'Welcome step',
  },
  {
    id: 'app-onboarding-welcomestep--default-dark',
    group: 'onboarding',
    theme: 'dark',
    rationale: 'Welcome step dark',
  },
  {
    id: 'app-onboarding-connectaccountstep--plaid-default',
    group: 'onboarding',
    theme: 'light',
    rationale: 'Connect account primary state',
  },
  {
    id: 'app-screens-dashboard--happy-path',
    group: 'authenticated_tabs',
    theme: 'light',
    rationale: 'Dashboard tab happy path',
  },
  {
    id: 'app-screens-dashboard--happy-path-dark',
    group: 'authenticated_tabs',
    theme: 'dark',
    rationale: 'Dashboard tab dark',
  },
  {
    id: 'app-screens-transactions--loaded',
    group: 'authenticated_tabs',
    theme: 'light',
    rationale: 'Transactions tab with rows',
  },
  {
    id: 'app-screens-transactions--loaded-dark',
    group: 'authenticated_tabs',
    theme: 'dark',
    rationale: 'Transactions table dark',
  },
  {
    id: 'app-screens-budgets--loaded',
    group: 'authenticated_tabs',
    theme: 'light',
    rationale: 'Budgets tab list',
  },
  {
    id: 'app-screens-budgets--loaded-dark',
    group: 'authenticated_tabs',
    theme: 'dark',
    rationale: 'Budgets tab dark',
  },
  {
    id: 'app-screens-accounts--connected',
    group: 'authenticated_tabs',
    theme: 'light',
    rationale: 'Accounts connected institutions',
  },
  {
    id: 'app-screens-accounts--connected-dark',
    group: 'authenticated_tabs',
    theme: 'dark',
    rationale: 'Accounts tab dark',
  },
  {
    id: 'app-screens-settings--default',
    group: 'authenticated_tabs',
    theme: 'light',
    rationale: 'Settings password panel',
  },
  {
    id: 'app-screens-settings--default-dark',
    group: 'authenticated_tabs',
    theme: 'dark',
    rationale: 'Settings tab dark',
  },
] as const;

export const VISUAL_STORYBOOK_MATRIX_IDS: readonly string[] = VISUAL_STORYBOOK_MATRIX.map(
  (e) => e.id
);
