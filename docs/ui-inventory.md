# UI Inventory

Generated from `src` and `../DESIGN.md` on 2026-05-09T18:47:19.896Z.

## @/ui/tokens

| symbol | consumer files | consumer count |
| --- | --- | --- |
| `designTokens` | `SessionManager.tsx`, `components/AccountRow.tsx`, `components/Amount.tsx`, `components/DisconnectModal.tsx`, `components/ErrorBoundary.tsx`, `components/Footer.tsx`, `components/HeaderAccountFilter.tsx`, `components/NetWorthOverTimeWidget.tsx`, `components/PasswordChecker.tsx`, `components/ProviderMismatchModal.tsx`, `components/StatusPill.tsx`, `components/Toast.tsx`, `components/onboarding/ConnectAccountStep.tsx`, `components/onboarding/OnboardingWizard.tsx`, `components/onboarding/WelcomeStep.tsx`, `components/widgets/HeroStatCard.tsx`, `features/analytics/components/DashboardChartCard.stories.tsx`, `features/analytics/components/DashboardChartCard.tsx`, `features/analytics/components/SpendingByCategoryChart.tsx`, `features/analytics/components/TopMerchantsList.tsx`, `features/budgets/components/BudgetList.tsx`, `features/budgets/components/BudgetProgress.tsx`, `features/budgets/components/BudgetSummaryCard.tsx`, `features/budgets/components/BudgetToolbar.tsx`, `features/plaid/components/AccountsSummaryStats.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx`, `features/transactions/components/TransactionsFilters.tsx`, `features/transactions/components/TransactionsTable.tsx`, `layouts/AppLayout.stories.tsx`, `layouts/PageLayout.tsx`, `storybook/screenSlices/AccountsScreenSlice.tsx`, `storybook/screenSlices/AuthenticatedScreenShell.tsx`, `storybook/screenSlices/DashboardScreenSlice.tsx`, `storybook/screenSlices/SettingsScreenSlice.tsx`, `storybook/screenSlices/TransactionsScreenSlice.tsx`, `storybook/shells/AppChrome.stories.tsx`, `ui/primitives/Alert.tsx`, `ui/primitives/AppTitleBar.stories.tsx`, `ui/primitives/AppTitleBar.tsx`, `ui/primitives/Badge.tsx`, `ui/primitives/Button.tsx`, `ui/primitives/EmptyState.tsx`, `ui/primitives/FormLabel.tsx`, `ui/primitives/GlassCard.stories.tsx`, `ui/primitives/GlassCard.tsx`, `ui/primitives/GradientShell.stories.tsx`, `ui/primitives/GradientShell.tsx`, `ui/primitives/Input.tsx`, `ui/primitives/MenuDropdown.tsx`, `ui/primitives/Modal.tsx`, `ui/primitives/RequirementPill.tsx`, `ui/primitives/Select.tsx`, `utils/providerCards.ts`, `views/AccountsPage.tsx`, `views/DashboardPage.tsx`, `views/SettingsPage.tsx`, `views/TransactionsPage.tsx`, `views/tokenRecipes.ts` | 58 |
| `getCategoryAccent` | `utils/categories.ts` | 1 |
| `getHeroAccentTheme` | `components/widgets/HeroStatCard.tsx` | 1 |
| `getThemeColors` | `context/ThemeContext.tsx` | 1 |
| `ThemeColors` | `context/ThemeContext.tsx` | 1 |
| `ThemeMode` | `context/ThemeContext.tsx` | 1 |

## @/ui/tokens/textRecipes

| symbol | consumer files | consumer count |
| --- | --- | --- |
| `semanticTextRecipes` | `ui/primitives/tokenRecipes.ts` | 1 |

## @/ui/primitives/tokenRecipes

| symbol | consumer files | consumer count |
| --- | --- | --- |
| `primitiveTokenRecipes` | `ui/tokens/index.ts` | 1 |
| `primitiveTypographyRecipes` | `components/onboarding/tokenRecipes.ts`, `features/budgets/tokenRecipes.ts`, `ui/tokens/index.ts` | 3 |

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
| `onboardingTokenRecipes` | `ui/tokens/index.ts` | 1 |

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
| `designTokens.colors` | `components/AccountRow.tsx`, `ui/tokens/index.ts` | 2 |
| `designTokens.colors.accountTypeDot` | `components/AccountRow.tsx` | 1 |
| `designTokens.colors.accountTypeDot[type]` | `components/AccountRow.tsx` | 1 |
| `designTokens.colors.categoryAccents` | `ui/tokens/index.ts` | 1 |
| `designTokens.colors.categoryAccents.length` | `ui/tokens/index.ts` | 1 |
| `designTokens.colors.categoryAccents[hashString(key) % designTokens.colors.categoryAccents.length]` | `ui/tokens/index.ts` | 1 |
| `designTokens.colors.theme` | `ui/tokens/index.ts` | 1 |
| `designTokens.colors.theme.dark` | `ui/tokens/index.ts` | 1 |
| `designTokens.colors.theme.light` | `ui/tokens/index.ts` | 1 |
| `designTokens.components` | `components/onboarding/ConnectAccountStep.tsx`, `components/onboarding/WelcomeStep.tsx`, `components/widgets/HeroStatCard.tsx`, `features/budgets/components/BudgetList.tsx`, `features/budgets/components/BudgetProgress.tsx`, `features/budgets/components/BudgetToolbar.tsx`, `features/transactions/components/TransactionsFilters.tsx`, `features/transactions/components/TransactionsTable.tsx`, `layouts/PageLayout.tsx`, `storybook/screenSlices/AccountsScreenSlice.tsx`, `ui/primitives/AppTitleBar.tsx`, `ui/primitives/Badge.tsx`, `ui/primitives/Button.tsx`, `ui/primitives/EmptyState.tsx`, `ui/primitives/GlassCard.tsx`, `ui/primitives/GradientShell.tsx`, `ui/primitives/Input.tsx`, `ui/primitives/MenuDropdown.tsx`, `ui/primitives/Select.tsx`, `ui/tokens/index.ts`, `utils/providerCards.ts`, `views/AccountsPage.tsx` | 22 |
| `designTokens.components.actions` | `features/budgets/components/BudgetList.tsx`, `features/budgets/components/BudgetToolbar.tsx`, `features/transactions/components/TransactionsTable.tsx`, `storybook/screenSlices/AccountsScreenSlice.tsx`, `views/AccountsPage.tsx` | 5 |
| `designTokens.components.actions.accountsToolbar` | `storybook/screenSlices/AccountsScreenSlice.tsx`, `views/AccountsPage.tsx` | 2 |
| `designTokens.components.actions.budgetDeleteIcon` | `features/budgets/components/BudgetList.tsx` | 1 |
| `designTokens.components.actions.budgetIconGhost` | `features/budgets/components/BudgetList.tsx` | 1 |
| `designTokens.components.actions.budgetSaveIcon` | `features/budgets/components/BudgetList.tsx` | 1 |
| `designTokens.components.actions.paginationRound` | `features/budgets/components/BudgetToolbar.tsx`, `features/transactions/components/TransactionsTable.tsx` | 2 |
| `designTokens.components.appTitleBar` | `ui/primitives/AppTitleBar.tsx` | 1 |
| `designTokens.components.appTitleBar.base` | `ui/primitives/AppTitleBar.tsx` | 1 |
| `designTokens.components.appTitleBar.height` | `ui/primitives/AppTitleBar.tsx` | 1 |
| `designTokens.components.appTitleBar.height.default` | `ui/primitives/AppTitleBar.tsx` | 1 |
| `designTokens.components.appTitleBar.height.scrolled` | `ui/primitives/AppTitleBar.tsx` | 1 |
| `designTokens.components.appTitleBar.logo` | `ui/primitives/AppTitleBar.tsx` | 1 |
| `designTokens.components.appTitleBar.logo.container` | `ui/primitives/AppTitleBar.tsx` | 1 |
| `designTokens.components.appTitleBar.logo.default` | `ui/primitives/AppTitleBar.tsx` | 1 |
| `designTokens.components.appTitleBar.logo.scrolled` | `ui/primitives/AppTitleBar.tsx` | 1 |
| `designTokens.components.appTitleBar.logo.wordmark` | `ui/primitives/AppTitleBar.tsx` | 1 |
| `designTokens.components.appTitleBar.settingsIdle` | `ui/primitives/AppTitleBar.tsx` | 1 |
| `designTokens.components.appTitleBar.shell` | `ui/primitives/AppTitleBar.tsx` | 1 |
| `designTokens.components.appTitleBar.tabHalo` | `ui/primitives/AppTitleBar.tsx` | 1 |
| `designTokens.components.appTitleBar.tabIdle` | `ui/primitives/AppTitleBar.tsx` | 1 |
| `designTokens.components.appTitleBar.themeToggle` | `ui/primitives/AppTitleBar.tsx` | 1 |
| `designTokens.components.badge` | `ui/primitives/Badge.tsx` | 1 |
| `designTokens.components.badge.base` | `ui/primitives/Badge.tsx` | 1 |
| `designTokens.components.badge.default` | `ui/primitives/Badge.tsx` | 1 |
| `designTokens.components.badge.feature` | `ui/primitives/Badge.tsx` | 1 |
| `designTokens.components.badge.primary` | `ui/primitives/Badge.tsx` | 1 |
| `designTokens.components.budgetCard` | `features/budgets/components/BudgetList.tsx` | 1 |
| `designTokens.components.budgetCard.shell` | `features/budgets/components/BudgetList.tsx` | 1 |
| `designTokens.components.budgetProgress` | `features/budgets/components/BudgetProgress.tsx` | 1 |
| `designTokens.components.button` | `ui/primitives/Button.tsx` | 1 |
| `designTokens.components.button.base` | `ui/primitives/Button.tsx` | 1 |
| `designTokens.components.button.connect` | `ui/primitives/Button.tsx` | 1 |
| `designTokens.components.button.danger` | `ui/primitives/Button.tsx` | 1 |
| `designTokens.components.button.ghost` | `ui/primitives/Button.tsx` | 1 |
| `designTokens.components.button.icon` | `ui/primitives/Button.tsx` | 1 |
| `designTokens.components.button.primary` | `ui/primitives/Button.tsx` | 1 |
| `designTokens.components.button.secondary` | `ui/primitives/Button.tsx` | 1 |
| `designTokens.components.button.success` | `ui/primitives/Button.tsx` | 1 |
| `designTokens.components.button.tab` | `ui/primitives/Button.tsx` | 1 |
| `designTokens.components.button.tabActive` | `ui/primitives/Button.tsx` | 1 |
| `designTokens.components.emptyState` | `ui/primitives/EmptyState.tsx` | 1 |
| `designTokens.components.emptyState.description` | `ui/primitives/EmptyState.tsx` | 1 |
| `designTokens.components.emptyState.iconWrapper` | `ui/primitives/EmptyState.tsx` | 1 |
| `designTokens.components.emptyState.title` | `ui/primitives/EmptyState.tsx` | 1 |
| `designTokens.components.glassCard` | `ui/primitives/GlassCard.tsx` | 1 |
| `designTokens.components.glassCard.accent` | `ui/primitives/GlassCard.tsx` | 1 |
| `designTokens.components.glassCard.auth` | `ui/primitives/GlassCard.tsx` | 1 |
| `designTokens.components.glassCard.base` | `ui/primitives/GlassCard.tsx` | 1 |
| `designTokens.components.glassCard.default` | `ui/primitives/GlassCard.tsx` | 1 |
| `designTokens.components.glassCard.padding` | `ui/primitives/GlassCard.tsx` | 1 |
| `designTokens.components.glassCard.padding.lg` | `ui/primitives/GlassCard.tsx` | 1 |
| `designTokens.components.glassCard.padding.md` | `ui/primitives/GlassCard.tsx` | 1 |
| `designTokens.components.glassCard.padding.none` | `ui/primitives/GlassCard.tsx` | 1 |
| `designTokens.components.glassCard.padding.sm` | `ui/primitives/GlassCard.tsx` | 1 |
| `designTokens.components.glassCard.rounded` | `ui/primitives/GlassCard.tsx` | 1 |
| `designTokens.components.glassCard.rounded.default` | `ui/primitives/GlassCard.tsx` | 1 |
| `designTokens.components.glassCard.rounded.lg` | `ui/primitives/GlassCard.tsx` | 1 |
| `designTokens.components.glassCard.rounded.xl` | `ui/primitives/GlassCard.tsx` | 1 |
| `designTokens.components.gradientShell` | `ui/primitives/GradientShell.tsx` | 1 |
| `designTokens.components.gradientShell.aura` | `ui/primitives/GradientShell.tsx` | 1 |
| `designTokens.components.gradientShell.base` | `ui/primitives/GradientShell.tsx` | 1 |
| `designTokens.components.gradientShell.centered` | `ui/primitives/GradientShell.tsx` | 1 |
| `designTokens.components.gradientShell.centerGlow` | `ui/primitives/GradientShell.tsx` | 1 |
| `designTokens.components.gradientShell.contentCentered` | `ui/primitives/GradientShell.tsx` | 1 |
| `designTokens.components.gradientShell.cyanAura` | `ui/primitives/GradientShell.tsx` | 1 |
| `designTokens.components.gradientShell.overlay` | `ui/primitives/GradientShell.tsx` | 1 |
| `designTokens.components.gradientShell.vignette` | `ui/primitives/GradientShell.tsx` | 1 |
| `designTokens.components.gradientShell.vignetteOverlay` | `ui/primitives/GradientShell.tsx` | 1 |
| `designTokens.components.gradientShell.violetAura` | `ui/primitives/GradientShell.tsx` | 1 |
| `designTokens.components.heroStatCard` | `components/widgets/HeroStatCard.tsx`, `ui/tokens/index.ts` | 2 |
| `designTokens.components.heroStatCard.accent` | `ui/tokens/index.ts` | 1 |
| `designTokens.components.heroStatCard.accent[accent]` | `ui/tokens/index.ts` | 1 |
| `designTokens.components.heroStatCard.base` | `components/widgets/HeroStatCard.tsx` | 1 |
| `designTokens.components.heroStatCard.footerInner` | `components/widgets/HeroStatCard.tsx` | 1 |
| `designTokens.components.heroStatCard.ring` | `components/widgets/HeroStatCard.tsx` | 1 |
| `designTokens.components.heroStatCard.ringLine` | `components/widgets/HeroStatCard.tsx` | 1 |
| `designTokens.components.heroStatCard.semantic` | `components/widgets/HeroStatCard.tsx` | 1 |
| `designTokens.components.heroStatCard.semantic[p.tone]` | `components/widgets/HeroStatCard.tsx` | 1 |
| `designTokens.components.heroStatCard.shell` | `components/widgets/HeroStatCard.tsx` | 1 |
| `designTokens.components.heroStatCard.suffix` | `components/widgets/HeroStatCard.tsx` | 1 |
| `designTokens.components.heroStatCard.title` | `components/widgets/HeroStatCard.tsx` | 1 |
| `designTokens.components.heroStatCard.value` | `components/widgets/HeroStatCard.tsx` | 1 |
| `designTokens.components.input` | `ui/primitives/Input.tsx` | 1 |
| `designTokens.components.input.base` | `ui/primitives/Input.tsx` | 1 |
| `designTokens.components.input.default` | `ui/primitives/Input.tsx` | 1 |
| `designTokens.components.input.glass` | `ui/primitives/Input.tsx` | 1 |
| `designTokens.components.input.invalid` | `ui/primitives/Input.tsx` | 1 |
| `designTokens.components.input.size` | `ui/primitives/Input.tsx` | 1 |
| `designTokens.components.input.size.lg` | `ui/primitives/Input.tsx` | 1 |
| `designTokens.components.input.size.md` | `ui/primitives/Input.tsx` | 1 |
| `designTokens.components.input.size.sm` | `ui/primitives/Input.tsx` | 1 |
| `designTokens.components.menuDropdown` | `ui/primitives/MenuDropdown.tsx` | 1 |
| `designTokens.components.menuDropdown.content` | `ui/primitives/MenuDropdown.tsx` | 1 |
| `designTokens.components.menuDropdown.item` | `ui/primitives/MenuDropdown.tsx` | 1 |
| `designTokens.components.onboarding` | `components/onboarding/ConnectAccountStep.tsx`, `components/onboarding/WelcomeStep.tsx`, `utils/providerCards.ts` | 3 |
| `designTokens.components.onboarding.bodyMuted` | `components/onboarding/WelcomeStep.tsx` | 1 |
| `designTokens.components.onboarding.eyebrowCaps` | `components/onboarding/ConnectAccountStep.tsx`, `components/onboarding/WelcomeStep.tsx` | 2 |
| `designTokens.components.onboarding.hoverOverlay` | `components/onboarding/ConnectAccountStep.tsx`, `components/onboarding/WelcomeStep.tsx` | 2 |
| `designTokens.components.onboarding.iconGlow` | `components/onboarding/ConnectAccountStep.tsx`, `components/onboarding/WelcomeStep.tsx` | 2 |
| `designTokens.components.onboarding.iconWell` | `components/onboarding/ConnectAccountStep.tsx`, `components/onboarding/WelcomeStep.tsx` | 2 |
| `designTokens.components.onboarding.iconWellLarge` | `components/onboarding/ConnectAccountStep.tsx` | 1 |
| `designTokens.components.onboarding.previewFrame` | `components/onboarding/WelcomeStep.tsx` | 1 |
| `designTokens.components.onboarding.providerConnect` | `utils/providerCards.ts` | 1 |
| `designTokens.components.onboarding.providerConnect.plaidEyebrowBg` | `utils/providerCards.ts` | 1 |
| `designTokens.components.onboarding.providerConnect.plaidEyebrowText` | `utils/providerCards.ts` | 1 |
| `designTokens.components.onboarding.providerConnect.tellerEyebrowBg` | `utils/providerCards.ts` | 1 |
| `designTokens.components.onboarding.providerConnect.tellerEyebrowText` | `utils/providerCards.ts` | 1 |
| `designTokens.components.onboarding.providerHoverOverlay` | `components/onboarding/ConnectAccountStep.tsx` | 1 |
| `designTokens.components.onboarding.providerIconGlow` | `components/onboarding/ConnectAccountStep.tsx` | 1 |
| `designTokens.components.onboarding.providerRow` | `components/onboarding/ConnectAccountStep.tsx` | 1 |
| `designTokens.components.onboarding.rowBodyMuted` | `components/onboarding/ConnectAccountStep.tsx` | 1 |
| `designTokens.components.onboarding.stepCard` | `components/onboarding/ConnectAccountStep.tsx`, `components/onboarding/WelcomeStep.tsx` | 2 |
| `designTokens.components.onboarding.titleStrong` | `components/onboarding/ConnectAccountStep.tsx`, `components/onboarding/WelcomeStep.tsx` | 2 |
| `designTokens.components.onboarding.titleStrongInline` | `components/onboarding/ConnectAccountStep.tsx` | 1 |
| `designTokens.components.pageLayout` | `layouts/PageLayout.tsx` | 1 |
| `designTokens.components.pageLayout.badge` | `layouts/PageLayout.tsx` | 1 |
| `designTokens.components.pageLayout.error` | `layouts/PageLayout.tsx` | 1 |
| `designTokens.components.pageLayout.errorText` | `layouts/PageLayout.tsx` | 1 |
| `designTokens.components.pageLayout.innerGradient` | `layouts/PageLayout.tsx` | 1 |
| `designTokens.components.pageLayout.innerRing` | `layouts/PageLayout.tsx` | 1 |
| `designTokens.components.pageLayout.shell` | `layouts/PageLayout.tsx` | 1 |
| `designTokens.components.pageLayout.subtitle` | `layouts/PageLayout.tsx` | 1 |
| `designTokens.components.pageLayout.title` | `layouts/PageLayout.tsx` | 1 |
| `designTokens.components.pill` | `components/widgets/HeroStatCard.tsx`, `features/budgets/components/BudgetList.tsx`, `features/transactions/components/TransactionsFilters.tsx`, `features/transactions/components/TransactionsTable.tsx` | 4 |
| `designTokens.components.pill.base` | `components/widgets/HeroStatCard.tsx`, `features/budgets/components/BudgetList.tsx`, `features/transactions/components/TransactionsFilters.tsx`, `features/transactions/components/TransactionsTable.tsx` | 4 |
| `designTokens.components.pill.dot` | `components/widgets/HeroStatCard.tsx`, `features/budgets/components/BudgetList.tsx`, `features/transactions/components/TransactionsFilters.tsx`, `features/transactions/components/TransactionsTable.tsx` | 4 |
| `designTokens.components.pill.fadeLeft` | `components/widgets/HeroStatCard.tsx`, `features/transactions/components/TransactionsFilters.tsx` | 2 |
| `designTokens.components.pill.fadeRight` | `components/widgets/HeroStatCard.tsx`, `features/transactions/components/TransactionsFilters.tsx` | 2 |
| `designTokens.components.select` | `ui/primitives/Select.tsx` | 1 |
| `designTokens.components.select.base` | `ui/primitives/Select.tsx` | 1 |
| `designTokens.components.select.default` | `ui/primitives/Select.tsx` | 1 |
| `designTokens.components.select.glass` | `ui/primitives/Select.tsx` | 1 |
| `designTokens.components.select.invalid` | `ui/primitives/Select.tsx` | 1 |
| `designTokens.components.select.size` | `ui/primitives/Select.tsx` | 1 |
| `designTokens.components.select.size.lg` | `ui/primitives/Select.tsx` | 1 |
| `designTokens.components.select.size.md` | `ui/primitives/Select.tsx` | 1 |
| `designTokens.components.select.size.sm` | `ui/primitives/Select.tsx` | 1 |
| `designTokens.components.transactions` | `features/transactions/components/TransactionsTable.tsx` | 1 |
| `designTokens.components.transactions.row` | `features/transactions/components/TransactionsTable.tsx` | 1 |
| `designTokens.components.transactions.row.even` | `features/transactions/components/TransactionsTable.tsx` | 1 |
| `designTokens.components.transactions.row.odd` | `features/transactions/components/TransactionsTable.tsx` | 1 |
| `designTokens.components.transactions.row.shell` | `features/transactions/components/TransactionsTable.tsx` | 1 |
| `designTokens.effects` | `components/onboarding/ConnectAccountStep.tsx`, `features/budgets/components/BudgetSummaryCard.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx` | 3 |
| `designTokens.effects.semantic` | `components/onboarding/ConnectAccountStep.tsx`, `features/budgets/components/BudgetSummaryCard.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx` | 3 |
| `designTokens.effects.semantic.dangerGlow` | `components/onboarding/ConnectAccountStep.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx` | 2 |
| `designTokens.effects.semantic.glassShadow` | `features/budgets/components/BudgetSummaryCard.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx` | 2 |
| `designTokens.palettes` | `components/onboarding/WelcomeStep.tsx`, `features/analytics/components/TopMerchantsList.tsx`, `utils/providerCards.ts` | 3 |
| `designTokens.palettes.brandAccent` | `features/analytics/components/TopMerchantsList.tsx` | 1 |
| `designTokens.palettes.brandAccent.cyan` | `features/analytics/components/TopMerchantsList.tsx` | 1 |
| `designTokens.palettes.brandAccent.cyan.background` | `features/analytics/components/TopMerchantsList.tsx` | 1 |
| `designTokens.palettes.brandAccent.emerald` | `features/analytics/components/TopMerchantsList.tsx` | 1 |
| `designTokens.palettes.brandAccent.emerald.background` | `features/analytics/components/TopMerchantsList.tsx` | 1 |
| `designTokens.palettes.feature` | `components/onboarding/WelcomeStep.tsx`, `utils/providerCards.ts` | 2 |
| `designTokens.palettes.feature.highlight` | `utils/providerCards.ts` | 1 |
| `designTokens.palettes.feature.highlight.amber` | `utils/providerCards.ts` | 1 |
| `designTokens.palettes.feature.highlight.emerald` | `utils/providerCards.ts` | 1 |
| `designTokens.palettes.feature.highlight.fuchsia` | `utils/providerCards.ts` | 1 |
| `designTokens.palettes.feature.highlight.sky` | `utils/providerCards.ts` | 1 |
| `designTokens.palettes.feature.highlight.violet` | `utils/providerCards.ts` | 1 |
| `designTokens.palettes.feature.providerFeature` | `utils/providerCards.ts` | 1 |
| `designTokens.palettes.feature.providerFeature.amber` | `utils/providerCards.ts` | 1 |
| `designTokens.palettes.feature.providerFeature.emerald` | `utils/providerCards.ts` | 1 |
| `designTokens.palettes.feature.providerFeature.purple` | `utils/providerCards.ts` | 1 |
| `designTokens.palettes.feature.welcome` | `components/onboarding/WelcomeStep.tsx` | 1 |
| `designTokens.palettes.feature.welcome.amber` | `components/onboarding/WelcomeStep.tsx` | 1 |
| `designTokens.palettes.feature.welcome.purple` | `components/onboarding/WelcomeStep.tsx` | 1 |
| `designTokens.palettes.feature.welcome.sky` | `components/onboarding/WelcomeStep.tsx` | 1 |
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
| `designTokens.text` | `App.tsx`, `Auth.tsx`, `SessionManager.tsx`, `components/AccountRow.tsx`, `components/Amount.tsx`, `components/AuthenticatedApp.tsx`, `components/BalancesOverview.tsx`, `components/BankCard.tsx`, `components/DisconnectModal.tsx`, `components/ErrorBoundary.tsx`, `components/Footer.tsx`, `components/HeaderAccountFilter.tsx`, `components/NetWorthOverTimeWidget.tsx`, `components/PasswordChecker.tsx`, `components/Toast.tsx`, `components/onboarding/ConnectAccountStep.tsx`, `components/onboarding/OnboardingWizard.tsx`, `components/onboarding/WelcomeStep.tsx`, `features/analytics/components/DashboardChartCard.stories.tsx`, `features/analytics/components/DashboardChartCard.tsx`, `features/analytics/components/SpendingByCategoryChart.tsx`, `features/analytics/components/TopMerchantsList.tsx`, `features/budgets/components/BudgetList.tsx`, `features/budgets/components/BudgetSummaryCard.tsx`, `features/budgets/components/BudgetToolbar.tsx`, `features/plaid/components/AccountsSummaryStats.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx`, `features/transactions/components/TransactionsFilters.tsx`, `features/transactions/components/TransactionsTable.tsx`, `layouts/AppLayout.stories.tsx`, `storybook/screenSlices/AuthenticatedScreenShell.tsx`, `storybook/screenSlices/DashboardScreenSlice.tsx`, `storybook/screenSlices/SettingsScreenSlice.tsx`, `storybook/screenSlices/TransactionsScreenSlice.tsx`, `storybook/shells/AppChrome.stories.tsx`, `ui/primitives/AppTitleBar.stories.tsx`, `ui/primitives/FormLabel.tsx`, `ui/primitives/GlassCard.stories.tsx`, `ui/primitives/GradientShell.stories.tsx`, `ui/primitives/RequirementPill.tsx`, `views/DashboardPage.tsx`, `views/SettingsPage.tsx`, `views/TransactionsPage.tsx`, `views/tokenRecipes.ts` | 44 |
| `designTokens.text.accent` | `components/Footer.tsx` | 1 |
| `designTokens.text.body` | `App.tsx`, `Auth.tsx`, `components/BalancesOverview.tsx`, `components/DisconnectModal.tsx`, `components/ErrorBoundary.tsx`, `components/Footer.tsx`, `components/HeaderAccountFilter.tsx`, `components/PasswordChecker.tsx`, `components/onboarding/ConnectAccountStep.tsx`, `components/onboarding/WelcomeStep.tsx`, `features/budgets/components/BudgetList.tsx`, `features/budgets/components/BudgetSummaryCard.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx`, `storybook/screenSlices/DashboardScreenSlice.tsx`, `storybook/screenSlices/SettingsScreenSlice.tsx`, `ui/primitives/GlassCard.stories.tsx`, `ui/primitives/GradientShell.stories.tsx`, `views/SettingsPage.tsx`, `views/tokenRecipes.ts` | 19 |
| `designTokens.text.danger` | `Auth.tsx`, `SessionManager.tsx`, `components/Amount.tsx`, `components/BalancesOverview.tsx`, `features/budgets/components/BudgetList.tsx`, `features/budgets/components/BudgetSummaryCard.tsx`, `features/plaid/components/AccountsSummaryStats.tsx`, `features/plaid/components/ProviderSelectionPanel.tsx`, `features/transactions/components/TransactionsTable.tsx`, `storybook/screenSlices/DashboardScreenSlice.tsx`, `storybook/screenSlices/SettingsScreenSlice.tsx`, `views/DashboardPage.tsx`, `views/SettingsPage.tsx` | 13 |
| `designTokens.text.info` | `components/BalancesOverview.tsx` | 1 |
| `designTokens.text.inverse` | `components/Footer.tsx`, `components/onboarding/OnboardingWizard.tsx` | 2 |
| `designTokens.text.label` | `Auth.tsx`, `components/PasswordChecker.tsx`, `features/transactions/components/TransactionsFilters.tsx`, `storybook/screenSlices/DashboardScreenSlice.tsx`, `ui/primitives/FormLabel.tsx`, `views/DashboardPage.tsx` | 6 |
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

