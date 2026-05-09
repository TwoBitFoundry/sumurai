# UI Inventory

Generated from `src` and `../DESIGN.md` on 2026-05-09T19:39:55.859Z.

## @/ui/recipes

| symbol | consumer files | consumer count |
| --- | --- | --- |
| `border as semanticBorders` | `components/onboarding/tokenRecipes.ts`, `features/budgets/tokenRecipes.ts`, `ui/primitives/recipes.ts`, `ui/tokens/index.ts`, `views/tokenRecipes.ts` | 5 |
| `chrome as buttonChromeInset` | `ui/primitives/recipes.ts` | 1 |
| `effect as semanticEffects` | `components/onboarding/tokenRecipes.ts`, `features/budgets/tokenRecipes.ts`, `ui/primitives/recipes.ts`, `ui/tokens/index.ts`, `views/tokenRecipes.ts` | 5 |
| `focus as focusSurfaces` | `ui/tokens/index.ts` | 1 |
| `font as primitiveTypographyRecipes` | `components/onboarding/tokenRecipes.ts`, `features/budgets/tokenRecipes.ts`, `ui/primitives/recipes.ts`, `ui/tokens/index.ts` | 4 |
| `placeholder as semanticPlaceholderTextRecipes` | `ui/tokens/index.ts` | 1 |
| `status as semanticStatus` | `components/onboarding/tokenRecipes.ts`, `features/budgets/tokenRecipes.ts`, `ui/primitives/recipes.ts` | 3 |
| `status as semanticStatusRecipes` | `ui/tokens/index.ts` | 1 |
| `surface as semanticSurfaces` | `components/onboarding/tokenRecipes.ts`, `features/budgets/tokenRecipes.ts`, `ui/primitives/recipes.ts`, `ui/tokens/index.ts`, `views/tokenRecipes.ts` | 5 |
| `text as semanticTextRecipes` | `ui/primitives/recipes.ts`, `ui/tokens/index.ts` | 2 |

## @/ui/tokens

| symbol | consumer files | consumer count |
| --- | --- | --- |
| `designTokens` | `SessionManager.tsx`, `components/AccountRow.tsx`, `components/Amount.tsx`, `components/DisconnectModal.tsx`, `components/ErrorBoundary.tsx`, `components/Footer.tsx`, `components/HeaderAccountFilter.tsx`, `components/NetWorthOverTimeWidget.tsx`, `components/PasswordChecker.tsx`, `components/ProviderMismatchModal.tsx`, `components/StatusPill.tsx`, `components/Toast.tsx`, `components/onboarding/ConnectAccountStep.tsx`, `components/onboarding/OnboardingWizard.tsx`, `components/onboarding/WelcomeStep.tsx`, `components/widgets/HeroStatCard.tsx`, `features/analytics/components/DashboardChartCard.stories.tsx`, `features/analytics/components/DashboardChartCard.tsx`, `features/analytics/components/SpendingByCategoryChart.tsx`, `features/analytics/components/TopMerchantsList.tsx`, `features/budgets/components/BudgetList.tsx`, `features/budgets/components/BudgetSummaryCard.tsx`, `features/budgets/components/BudgetToolbar.tsx`, `features/plaid/components/AccountsSummaryStats.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx`, `features/transactions/components/TransactionsFilters.tsx`, `features/transactions/components/TransactionsTable.tsx`, `layouts/AppLayout.stories.tsx`, `storybook/screenSlices/AccountsScreenSlice.tsx`, `storybook/screenSlices/AuthenticatedScreenShell.tsx`, `storybook/screenSlices/DashboardScreenSlice.tsx`, `storybook/screenSlices/SettingsScreenSlice.tsx`, `storybook/screenSlices/TransactionsScreenSlice.tsx`, `storybook/shells/AppChrome.stories.tsx`, `ui/primitives/Alert.tsx`, `ui/primitives/AppTitleBar.stories.tsx`, `ui/primitives/AppTitleBar.tsx`, `ui/primitives/Badge.tsx`, `ui/primitives/Button.tsx`, `ui/primitives/EmptyState.tsx`, `ui/primitives/FormLabel.tsx`, `ui/primitives/GlassCard.stories.tsx`, `ui/primitives/GlassCard.tsx`, `ui/primitives/GradientShell.stories.tsx`, `ui/primitives/GradientShell.tsx`, `ui/primitives/Input.tsx`, `ui/primitives/MenuDropdown.tsx`, `ui/primitives/Modal.tsx`, `ui/primitives/Pill.tsx`, `ui/primitives/RequirementPill.tsx`, `ui/primitives/Select.tsx`, `utils/providerCards.ts`, `views/AccountsPage.tsx`, `views/DashboardPage.tsx`, `views/SettingsPage.tsx`, `views/TransactionsPage.tsx`, `views/tokenRecipes.ts` | 57 |

## @/ui/tokens/textRecipes

| symbol | consumer files | consumer count |
| --- | --- | --- |
| _None_ | _None_ | 0 |

## @/ui/primitives/tokenRecipes

| symbol | consumer files | consumer count |
| --- | --- | --- |
| _None_ | _None_ | 0 |

## @/views/tokenRecipes

| symbol | consumer files | consumer count |
| --- | --- | --- |
| `dashboardTokenRecipes` | `features/analytics/components/TopMerchantsList.tsx`, `features/transactions/components/TransactionsTable.tsx`, `features/transactions/components/TransactionsToolbar.tsx`, `storybook/screenSlices/DashboardScreenSlice.tsx` | 4 |

## @/features/budgets/tokenRecipes

| symbol | consumer files | consumer count |
| --- | --- | --- |
| `budgetTokenRecipes` | `ui/tokens/index.ts` | 1 |

## @/components/onboarding/tokenRecipes

| symbol | consumer files | consumer count |
| --- | --- | --- |
| `onboardingTokenRecipes` | `components/onboarding/ConnectAccountStep.tsx`, `components/onboarding/WelcomeStep.tsx`, `ui/tokens/index.ts`, `utils/providerCards.ts` | 4 |

## designTokens access paths

| symbol | consumer files | consumer count |
| --- | --- | --- |
| `designTokens.borders` | `components/AccountRow.tsx`, `components/BalancesOverview.tsx`, `components/BankCard.tsx`, `components/Footer.tsx`, `components/HeaderAccountFilter.tsx`, `components/onboarding/OnboardingWizard.tsx`, `features/budgets/components/BudgetSummaryCard.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx`, `features/transactions/components/TransactionsTable.tsx` | 9 |
| `designTokens.borders.control` | `components/HeaderAccountFilter.tsx` | 1 |
| `designTokens.borders.default` | `components/BalancesOverview.tsx`, `components/Footer.tsx`, `components/HeaderAccountFilter.tsx`, `components/onboarding/OnboardingWizard.tsx`, `features/budgets/components/BudgetSummaryCard.tsx` | 5 |
| `designTokens.borders.divider` | `components/Footer.tsx`, `components/HeaderAccountFilter.tsx`, `components/onboarding/OnboardingWizard.tsx`, `features/transactions/components/TransactionsTable.tsx` | 4 |
| `designTokens.borders.glass` | `components/BankCard.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx` | 2 |
| `designTokens.borders.hoverAccent` | `features/budgets/components/BudgetSummaryCard.tsx` | 1 |
| `designTokens.borders.subtle` | `components/AccountRow.tsx` | 1 |
| `designTokens.effects` | `components/onboarding/ConnectAccountStep.tsx`, `features/budgets/components/BudgetSummaryCard.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx` | 3 |
| `designTokens.effects.semantic` | `components/onboarding/ConnectAccountStep.tsx`, `features/budgets/components/BudgetSummaryCard.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx` | 3 |
| `designTokens.effects.semantic.dangerGlow` | `components/onboarding/ConnectAccountStep.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx` | 2 |
| `designTokens.effects.semantic.glassShadow` | `features/budgets/components/BudgetSummaryCard.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx` | 2 |
| `designTokens.shadows` | `ui/primitives/GlassCard.tsx` | 1 |
| `designTokens.shadows.glassInset` | `ui/primitives/GlassCard.tsx` | 1 |
| `designTokens.shadows.glassInset.dark` | `ui/primitives/GlassCard.tsx` | 1 |
| `designTokens.shadows.glassInset.light` | `ui/primitives/GlassCard.tsx` | 1 |
| `designTokens.spacing` | `storybook/screenSlices/SettingsScreenSlice.tsx`, `views/SettingsPage.tsx` | 2 |
| `designTokens.spacing.labeledFieldGap` | `storybook/screenSlices/SettingsScreenSlice.tsx`, `views/SettingsPage.tsx` | 2 |
| `designTokens.status` | `components/AccountRow.tsx`, `components/BalancesOverview.tsx`, `components/BankCard.tsx`, `components/StatusPill.tsx`, `components/onboarding/ConnectAccountStep.tsx`, `components/onboarding/OnboardingWizard.tsx`, `components/onboarding/WelcomeStep.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx`, `ui/primitives/Alert.tsx` | 9 |
| `designTokens.status.danger` | `components/AccountRow.tsx`, `components/BalancesOverview.tsx`, `components/StatusPill.tsx`, `components/onboarding/ConnectAccountStep.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx`, `ui/primitives/Alert.tsx` | 6 |
| `designTokens.status.danger.border` | `components/onboarding/ConnectAccountStep.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx`, `ui/primitives/Alert.tsx` | 3 |
| `designTokens.status.danger.surface` | `components/StatusPill.tsx`, `components/onboarding/ConnectAccountStep.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx`, `ui/primitives/Alert.tsx` | 4 |
| `designTokens.status.danger.surface.join` | `components/StatusPill.tsx` | 1 |
| `designTokens.status.danger.text` | `components/AccountRow.tsx`, `components/BalancesOverview.tsx`, `components/StatusPill.tsx`, `components/onboarding/ConnectAccountStep.tsx`, `ui/primitives/Alert.tsx` | 5 |
| `designTokens.status.danger.text.join` | `components/StatusPill.tsx` | 1 |
| `designTokens.status.info` | `components/BalancesOverview.tsx`, `components/BankCard.tsx`, `components/onboarding/OnboardingWizard.tsx`, `components/onboarding/WelcomeStep.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx`, `ui/primitives/Alert.tsx` | 6 |
| `designTokens.status.info.border` | `components/onboarding/OnboardingWizard.tsx`, `ui/primitives/Alert.tsx` | 2 |
| `designTokens.status.info.icon` | `components/BankCard.tsx` | 1 |
| `designTokens.status.info.surface` | `components/onboarding/OnboardingWizard.tsx`, `components/onboarding/WelcomeStep.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx`, `ui/primitives/Alert.tsx` | 4 |
| `designTokens.status.info.text` | `components/BalancesOverview.tsx`, `components/onboarding/OnboardingWizard.tsx`, `components/onboarding/WelcomeStep.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx`, `ui/primitives/Alert.tsx` | 5 |
| `designTokens.status.success` | `components/AccountRow.tsx`, `components/BalancesOverview.tsx`, `components/StatusPill.tsx`, `components/onboarding/OnboardingWizard.tsx`, `ui/primitives/Alert.tsx` | 5 |
| `designTokens.status.success.border` | `components/onboarding/OnboardingWizard.tsx`, `ui/primitives/Alert.tsx` | 2 |
| `designTokens.status.success.strongSurface` | `components/onboarding/OnboardingWizard.tsx` | 1 |
| `designTokens.status.success.surface` | `components/StatusPill.tsx`, `ui/primitives/Alert.tsx` | 2 |
| `designTokens.status.success.surface.join` | `components/StatusPill.tsx` | 1 |
| `designTokens.status.success.text` | `components/AccountRow.tsx`, `components/BalancesOverview.tsx`, `components/StatusPill.tsx`, `ui/primitives/Alert.tsx` | 4 |
| `designTokens.status.success.text.join` | `components/StatusPill.tsx` | 1 |
| `designTokens.status.warning` | `components/BalancesOverview.tsx`, `components/StatusPill.tsx`, `ui/primitives/Alert.tsx` | 3 |
| `designTokens.status.warning.border` | `ui/primitives/Alert.tsx` | 1 |
| `designTokens.status.warning.surface` | `components/StatusPill.tsx`, `ui/primitives/Alert.tsx` | 2 |
| `designTokens.status.warning.surface.join` | `components/StatusPill.tsx` | 1 |
| `designTokens.status.warning.text` | `components/BalancesOverview.tsx`, `components/StatusPill.tsx`, `ui/primitives/Alert.tsx` | 3 |
| `designTokens.status.warning.text.join` | `components/StatusPill.tsx` | 1 |
| `designTokens.surfaces` | `components/AccountRow.tsx`, `components/BalancesOverview.tsx`, `components/Footer.tsx`, `components/HeaderAccountFilter.tsx`, `components/onboarding/OnboardingWizard.tsx`, `features/budgets/components/BudgetList.tsx`, `features/budgets/components/BudgetSummaryCard.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx`, `ui/primitives/Modal.tsx` | 9 |
| `designTokens.surfaces.focus` | `features/budgets/components/BudgetList.tsx` | 1 |
| `designTokens.surfaces.focus.ringOffsetLightOnDark` | `features/budgets/components/BudgetList.tsx` | 1 |
| `designTokens.surfaces.glass` | `components/onboarding/OnboardingWizard.tsx` | 1 |
| `designTokens.surfaces.glass.wizardBrandWash` | `components/onboarding/OnboardingWizard.tsx` | 1 |
| `designTokens.surfaces.glass.wizardInsetRing` | `components/onboarding/OnboardingWizard.tsx` | 1 |
| `designTokens.surfaces.glass.wizardSoftWash` | `components/onboarding/OnboardingWizard.tsx` | 1 |
| `designTokens.surfaces.layered` | `features/plaid/components/ProviderSelectionPanel.tsx` | 1 |
| `designTokens.surfaces.layered.eyebrowChip` | `features/plaid/components/ProviderSelectionPanel.tsx` | 1 |
| `designTokens.surfaces.semantic` | `components/AccountRow.tsx`, `components/BalancesOverview.tsx`, `components/Footer.tsx`, `components/HeaderAccountFilter.tsx`, `components/onboarding/OnboardingWizard.tsx`, `features/budgets/components/BudgetSummaryCard.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx`, `ui/primitives/Modal.tsx` | 8 |
| `designTokens.surfaces.semantic.card` | `components/AccountRow.tsx`, `components/BalancesOverview.tsx`, `components/Footer.tsx`, `components/HeaderAccountFilter.tsx`, `components/onboarding/OnboardingWizard.tsx`, `features/budgets/components/BudgetSummaryCard.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx` | 7 |
| `designTokens.surfaces.semantic.glassPanel` | `features/plaid/components/ProviderSelectionPanel.tsx` | 1 |
| `designTokens.surfaces.semantic.mutedChip` | `components/HeaderAccountFilter.tsx` | 1 |
| `designTokens.surfaces.semantic.overlay` | `ui/primitives/Modal.tsx` | 1 |
| `designTokens.text` | `App.tsx`, `Auth.tsx`, `SessionManager.tsx`, `components/AccountRow.tsx`, `components/Amount.tsx`, `components/AuthenticatedApp.tsx`, `components/BalancesOverview.tsx`, `components/BankCard.tsx`, `components/DisconnectModal.tsx`, `components/ErrorBoundary.tsx`, `components/Footer.tsx`, `components/HeaderAccountFilter.tsx`, `components/NetWorthOverTimeWidget.tsx`, `components/PasswordChecker.tsx`, `components/Toast.tsx`, `components/onboarding/ConnectAccountStep.tsx`, `components/onboarding/OnboardingWizard.tsx`, `components/onboarding/WelcomeStep.tsx`, `features/analytics/components/DashboardChartCard.stories.tsx`, `features/analytics/components/DashboardChartCard.tsx`, `features/analytics/components/SpendingByCategoryChart.tsx`, `features/analytics/components/TopMerchantsList.tsx`, `features/budgets/components/BudgetList.tsx`, `features/budgets/components/BudgetSummaryCard.tsx`, `features/budgets/components/BudgetToolbar.tsx`, `features/plaid/components/AccountsSummaryStats.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx`, `features/transactions/components/TransactionsFilters.tsx`, `features/transactions/components/TransactionsTable.tsx`, `layouts/AppLayout.stories.tsx`, `storybook/screenSlices/AuthenticatedScreenShell.tsx`, `storybook/screenSlices/DashboardScreenSlice.tsx`, `storybook/screenSlices/SettingsScreenSlice.tsx`, `storybook/screenSlices/TransactionsScreenSlice.tsx`, `storybook/shells/AppChrome.stories.tsx`, `ui/primitives/AppTitleBar.stories.tsx`, `ui/primitives/FormLabel.tsx`, `ui/primitives/GlassCard.stories.tsx`, `ui/primitives/GradientShell.stories.tsx`, `ui/primitives/Pill.tsx`, `ui/primitives/RequirementPill.tsx`, `views/DashboardPage.tsx`, `views/SettingsPage.tsx`, `views/TransactionsPage.tsx`, `views/tokenRecipes.ts` | 45 |
| `designTokens.text.accent` | `components/Footer.tsx` | 1 |
| `designTokens.text.body` | `App.tsx`, `Auth.tsx`, `components/BalancesOverview.tsx`, `components/DisconnectModal.tsx`, `components/ErrorBoundary.tsx`, `components/Footer.tsx`, `components/HeaderAccountFilter.tsx`, `components/PasswordChecker.tsx`, `components/onboarding/ConnectAccountStep.tsx`, `components/onboarding/WelcomeStep.tsx`, `features/budgets/components/BudgetList.tsx`, `features/budgets/components/BudgetSummaryCard.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx`, `storybook/screenSlices/DashboardScreenSlice.tsx`, `storybook/screenSlices/SettingsScreenSlice.tsx`, `ui/primitives/GlassCard.stories.tsx`, `ui/primitives/GradientShell.stories.tsx`, `views/SettingsPage.tsx`, `views/tokenRecipes.ts` | 19 |
| `designTokens.text.danger` | `Auth.tsx`, `SessionManager.tsx`, `components/Amount.tsx`, `components/BalancesOverview.tsx`, `features/budgets/components/BudgetList.tsx`, `features/budgets/components/BudgetSummaryCard.tsx`, `features/plaid/components/AccountsSummaryStats.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx`, `features/transactions/components/TransactionsTable.tsx`, `storybook/screenSlices/DashboardScreenSlice.tsx`, `storybook/screenSlices/SettingsScreenSlice.tsx`, `views/DashboardPage.tsx`, `views/SettingsPage.tsx` | 13 |
| `designTokens.text.info` | `components/BalancesOverview.tsx` | 1 |
| `designTokens.text.inverse` | `components/Footer.tsx`, `components/onboarding/OnboardingWizard.tsx` | 2 |
| `designTokens.text.label` | `Auth.tsx`, `components/PasswordChecker.tsx`, `features/transactions/components/TransactionsFilters.tsx`, `storybook/screenSlices/DashboardScreenSlice.tsx`, `ui/primitives/FormLabel.tsx`, `ui/primitives/Pill.tsx`, `views/DashboardPage.tsx` | 7 |
| `designTokens.text.muted` | `Auth.tsx`, `SessionManager.tsx`, `components/AccountRow.tsx`, `components/BalancesOverview.tsx`, `components/BankCard.tsx`, `components/ErrorBoundary.tsx`, `components/Footer.tsx`, `components/HeaderAccountFilter.tsx`, `components/NetWorthOverTimeWidget.tsx`, `features/analytics/components/DashboardChartCard.stories.tsx`, `features/analytics/components/DashboardChartCard.tsx`, `features/analytics/components/TopMerchantsList.tsx`, `features/budgets/components/BudgetToolbar.tsx`, `features/transactions/components/TransactionsTable.tsx`, `layouts/AppLayout.stories.tsx`, `storybook/screenSlices/AuthenticatedScreenShell.tsx`, `storybook/screenSlices/DashboardScreenSlice.tsx`, `storybook/screenSlices/TransactionsScreenSlice.tsx`, `storybook/shells/AppChrome.stories.tsx`, `ui/primitives/AppTitleBar.stories.tsx`, `ui/primitives/GlassCard.stories.tsx`, `views/DashboardPage.tsx`, `views/TransactionsPage.tsx` | 23 |
| `designTokens.text.primary` | `App.tsx`, `Auth.tsx`, `SessionManager.tsx`, `components/AccountRow.tsx`, `components/Amount.tsx`, `components/AuthenticatedApp.tsx`, `components/BankCard.tsx`, `components/ErrorBoundary.tsx`, `components/HeaderAccountFilter.tsx`, `components/Toast.tsx`, `components/onboarding/ConnectAccountStep.tsx`, `components/onboarding/WelcomeStep.tsx`, `features/analytics/components/DashboardChartCard.tsx`, `features/analytics/components/SpendingByCategoryChart.tsx`, `features/analytics/components/TopMerchantsList.tsx`, `features/budgets/components/BudgetList.tsx`, `features/budgets/components/BudgetSummaryCard.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx`, `features/transactions/components/TransactionsTable.tsx`, `storybook/screenSlices/DashboardScreenSlice.tsx`, `storybook/screenSlices/SettingsScreenSlice.tsx`, `storybook/shells/AppChrome.stories.tsx`, `views/DashboardPage.tsx`, `views/SettingsPage.tsx`, `views/TransactionsPage.tsx` | 25 |
| `designTokens.text.subtle` | `SessionManager.tsx`, `components/AccountRow.tsx`, `components/BalancesOverview.tsx`, `components/Footer.tsx`, `components/onboarding/OnboardingWizard.tsx`, `features/analytics/components/DashboardChartCard.tsx`, `features/budgets/components/BudgetList.tsx`, `features/budgets/components/BudgetSummaryCard.tsx`, `features/budgets/components/BudgetToolbar.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx`, `features/transactions/components/TransactionsTable.tsx`, `storybook/screenSlices/TransactionsScreenSlice.tsx`, `ui/primitives/FormLabel.tsx`, `ui/primitives/RequirementPill.tsx` | 14 |
| `designTokens.text.success` | `components/BalancesOverview.tsx`, `features/transactions/components/TransactionsTable.tsx`, `ui/primitives/RequirementPill.tsx` | 3 |
| `designTokens.text.warning` | `components/BalancesOverview.tsx` | 1 |
| `designTokens.textPlaceholder` | `features/transactions/components/TransactionsFilters.tsx` | 1 |
| `designTokens.textPlaceholder.muted` | `features/transactions/components/TransactionsFilters.tsx` | 1 |
| `designTokens.typography` | `App.tsx`, `Auth.tsx`, `SessionManager.tsx`, `components/AccountRow.tsx`, `components/BalancesOverview.tsx`, `components/BankCard.tsx`, `components/DisconnectModal.tsx`, `components/ErrorBoundary.tsx`, `components/Footer.tsx`, `components/HeaderAccountFilter.tsx`, `components/NetWorthOverTimeWidget.tsx`, `components/PasswordChecker.tsx`, `components/ProviderMismatchModal.tsx`, `components/StatusPill.tsx`, `components/Toast.tsx`, `components/onboarding/ConnectAccountStep.tsx`, `components/onboarding/OnboardingWizard.tsx`, `components/onboarding/WelcomeStep.tsx`, `features/analytics/components/DashboardChartCard.tsx`, `features/analytics/components/SpendingByCategoryChart.tsx`, `features/analytics/components/TopMerchantsList.tsx`, `features/budgets/components/BudgetList.tsx`, `features/budgets/components/BudgetSummaryCard.tsx`, `features/budgets/components/BudgetToolbar.tsx`, `features/plaid/components/AccountsSummaryStats.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx`, `features/transactions/components/TransactionsFilters.tsx`, `features/transactions/components/TransactionsTable.tsx`, `storybook/screenSlices/AuthenticatedScreenShell.tsx`, `storybook/screenSlices/DashboardScreenSlice.tsx`, `storybook/screenSlices/SettingsScreenSlice.tsx`, `storybook/shells/AppChrome.stories.tsx`, `ui/primitives/Alert.tsx`, `ui/primitives/AppTitleBar.tsx`, `ui/primitives/Button.tsx`, `ui/primitives/FormLabel.tsx`, `ui/primitives/RequirementPill.tsx`, `views/DashboardPage.tsx`, `views/SettingsPage.tsx`, `views/TransactionsPage.tsx` | 40 |
| `designTokens.typography.badge` | `ui/primitives/RequirementPill.tsx` | 1 |
| `designTokens.typography.body` | `App.tsx`, `Auth.tsx`, `SessionManager.tsx`, `components/DisconnectModal.tsx`, `components/ErrorBoundary.tsx`, `components/Footer.tsx`, `components/ProviderMismatchModal.tsx`, `components/onboarding/ConnectAccountStep.tsx`, `components/onboarding/WelcomeStep.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx`, `features/transactions/components/TransactionsTable.tsx`, `storybook/screenSlices/DashboardScreenSlice.tsx`, `storybook/screenSlices/SettingsScreenSlice.tsx`, `ui/primitives/Alert.tsx`, `views/DashboardPage.tsx`, `views/SettingsPage.tsx` | 16 |
| `designTokens.typography.bodyStrong` | `components/AccountRow.tsx`, `components/BankCard.tsx`, `components/ProviderMismatchModal.tsx`, `components/onboarding/ConnectAccountStep.tsx`, `features/analytics/components/TopMerchantsList.tsx`, `features/budgets/components/BudgetList.tsx`, `features/plaid/components/AccountsSummaryStats.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx`, `ui/primitives/Button.tsx`, `views/DashboardPage.tsx` | 10 |
| `designTokens.typography.brand` | `ui/primitives/AppTitleBar.tsx` | 1 |
| `designTokens.typography.caption` | `Auth.tsx`, `SessionManager.tsx`, `components/BalancesOverview.tsx`, `components/BankCard.tsx`, `components/Footer.tsx`, `components/HeaderAccountFilter.tsx`, `components/PasswordChecker.tsx`, `components/onboarding/ConnectAccountStep.tsx`, `components/onboarding/OnboardingWizard.tsx`, `features/analytics/components/DashboardChartCard.tsx`, `features/analytics/components/TopMerchantsList.tsx`, `features/budgets/components/BudgetList.tsx`, `features/budgets/components/BudgetToolbar.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx`, `features/transactions/components/TransactionsTable.tsx`, `storybook/screenSlices/AuthenticatedScreenShell.tsx`, `storybook/screenSlices/DashboardScreenSlice.tsx`, `storybook/screenSlices/SettingsScreenSlice.tsx`, `storybook/shells/AppChrome.stories.tsx`, `views/DashboardPage.tsx`, `views/SettingsPage.tsx`, `views/TransactionsPage.tsx` | 22 |
| `designTokens.typography.captionStrong` | `components/AccountRow.tsx`, `components/BalancesOverview.tsx`, `components/HeaderAccountFilter.tsx`, `components/NetWorthOverTimeWidget.tsx`, `components/Toast.tsx`, `ui/primitives/Alert.tsx`, `ui/primitives/Button.tsx`, `views/DashboardPage.tsx` | 8 |
| `designTokens.typography.cardTitle` | `SessionManager.tsx`, `components/BankCard.tsx`, `components/ErrorBoundary.tsx`, `features/analytics/components/DashboardChartCard.tsx`, `features/budgets/components/BudgetList.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx`, `storybook/screenSlices/SettingsScreenSlice.tsx`, `views/SettingsPage.tsx`, `views/TransactionsPage.tsx` | 9 |
| `designTokens.typography.chartDonutCenterTotal` | `features/analytics/components/SpendingByCategoryChart.tsx` | 1 |
| `designTokens.typography.confirmationCode` | `storybook/screenSlices/SettingsScreenSlice.tsx`, `views/SettingsPage.tsx` | 2 |
| `designTokens.typography.label` | `Auth.tsx`, `components/AccountRow.tsx`, `components/BalancesOverview.tsx`, `components/BankCard.tsx`, `components/Footer.tsx`, `components/PasswordChecker.tsx`, `components/ProviderMismatchModal.tsx`, `components/StatusPill.tsx`, `components/onboarding/OnboardingWizard.tsx`, `features/analytics/components/TopMerchantsList.tsx`, `features/budgets/components/BudgetList.tsx`, `features/budgets/components/BudgetSummaryCard.tsx`, `features/budgets/components/BudgetToolbar.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx`, `features/transactions/components/TransactionsFilters.tsx`, `features/transactions/components/TransactionsTable.tsx`, `ui/primitives/Button.tsx`, `ui/primitives/FormLabel.tsx`, `views/DashboardPage.tsx` | 19 |
| `designTokens.typography.pageTitle` | `Auth.tsx`, `components/onboarding/ConnectAccountStep.tsx`, `components/onboarding/WelcomeStep.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx` | 4 |
| `designTokens.typography.sectionTitle` | `storybook/screenSlices/SettingsScreenSlice.tsx`, `views/SettingsPage.tsx` | 2 |
| `designTokens.typography.titleBarChromeExpanded` | `ui/primitives/Button.tsx` | 1 |

## DESIGN.md components with zero references

- `app-title-bar-wordmark`
- `app-title-bar-chrome-expanded`
- `button-primary`
- `button-secondary`
- `button-icon`
- `input-default`
- `input-invalid`
- `input-glass`
- `select-default`
- `select-invalid`
- `select-glass`
- `glass-card`
- `page-shell`
- `pill`
- `hero-stat-card`
- `budget-progress-track`
- `budget-progress-track-dark`
- `budget-progress-fill-within`
- `budget-progress-fill-over`
- `budget-progress-caption-row`
- `budget-progress-caption-summary`
- `budget-progress-caption-danger`
- `surface-panel-glass-dark`
- `surface-layered-panel-dark`
- `surface-data-row-dark`
- `surface-secondary-text`
- `surface-secondary-text-dark`
- `budget-card-shell`
- `budget-card-shell-dark`
- `pagination-round-button`
- `pagination-round-button-dark`
- `accounts-toolbar-button`
- `accounts-toolbar-button-dark`
- `provider-connect-plaid-eyebrow`
- `provider-connect-teller-eyebrow`
- `onboarding-step-card`
- `onboarding-step-card-dark`
- `onboarding-preview-frame`
- `onboarding-body-muted`
- `onboarding-body-muted-dark`
- `brand-accent-sky`
- `brand-accent-sky-dark`
- `brand-accent-emerald`
- `brand-accent-emerald-dark`
- `brand-accent-amber`
- `brand-accent-amber-dark`
- `brand-accent-rose`
- `brand-accent-rose-dark`
- `brand-accent-violet`
- `brand-accent-violet-dark`
- `brand-accent-cyan`
- `brand-accent-cyan-dark`
- `chart-series-light-1`
- `chart-series-light-2`
- `chart-series-light-3`
- `chart-series-light-4`
- `chart-series-light-5`
- `chart-series-light-6`
- `chart-series-dark-1`
- `chart-series-dark-2`
- `chart-series-dark-3`
- `chart-series-dark-4`
- `chart-series-dark-5`
- `chart-series-dark-6`
- `chart-tooltip-light`
- `chart-tooltip-dark`
- `chart-tooltip-border-light`
- `chart-tooltip-border-dark`
- `chart-axis-dark`
- `chart-dot-light`
- `chart-dot-dark`
- `finance-cash-light`
- `finance-investments-light`
- `finance-credit-light`
- `finance-loan-light`
- `finance-net-worth-light`
- `finance-cash-dark`
- `finance-investments-dark`
- `finance-credit-dark`
- `finance-loan-dark`
- `finance-net-worth-dark`
- `category-pill-sky`
- `category-pill-emerald`
- `category-pill-cyan`
- `category-pill-violet`
- `category-pill-amber`
- `category-pill-rose`
- `category-pill-indigo`
- `category-pill-fuchsia`
- `category-pill-teal`
- `category-pill-lime`

