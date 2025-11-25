import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { jest } from '@jest/globals'
import { ThemeProvider } from '@/context/ThemeContext'
jest.mock('@/hooks/useScrollDetection', () => ({
  useScrollDetection: () => false,
}))

// Mock boundary components so copy tweaks do not break contract tests
const mockWelcomeStep = jest.fn(() => <div data-testid="welcome-step">Welcome Step</div>)
const mockConnectAccountStep = jest.fn(() => <div data-testid="connect-step">Connect Step</div>)
const mockUseOnboardingWizard = jest.fn()
const mockUseOnboardingPlaidFlow = jest.fn()
const mockUseOnboardingTellerFlow = jest.fn()
const mockUseTellerProviderInfo = jest.fn()
const mockProviderContent = {
  plaid: {
    displayName: 'Plaid',
    eyebrow: {
      text: '',
      backgroundClassName: '',
      textClassName: '',
    },
    heroTitle: '',
    heroDescription: '',
    highlightLabel: '',
    highlightMeta: '',
    features: [],
    highlights: [],
    cta: {
      defaultLabel: '',
    },
    securityNote: 'Plaid security note',
  },
  teller: {
    displayName: 'Teller',
    eyebrow: {
      text: '',
      backgroundClassName: '',
      textClassName: '',
    },
    heroTitle: '',
    heroDescription: '',
    highlightLabel: '',
    highlightMeta: '',
    features: [],
    highlights: [],
    cta: {
      defaultLabel: '',
    },
    securityNote: 'Teller security note',
    requiresApplicationId: true,
    applicationIdMissingCopy: 'Missing application ID',
  },
}

jest.mock('@/components/onboarding/WelcomeStep', () => ({
  WelcomeStep: mockWelcomeStep,
}))

jest.mock('@/components/onboarding/ConnectAccountStep', () => {
  return {
    ConnectAccountStep: mockConnectAccountStep,
  }
})

jest.mock('@/utils/providerCards', () => ({
  CONNECT_ACCOUNT_PROVIDER_CONTENT: mockProviderContent,
  getProviderCardConfig: jest.fn(),
  getConnectAccountProviderContent: (provider: keyof typeof mockProviderContent) =>
    mockProviderContent[provider],
}))

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>)
}

jest.mock('@/hooks/useOnboardingWizard', () => ({
  useOnboardingWizard: mockUseOnboardingWizard,
}))
jest.mock('@/hooks/useOnboardingPlaidFlow', () => ({
  useOnboardingPlaidFlow: mockUseOnboardingPlaidFlow,
}))
jest.mock('@/hooks/useOnboardingTellerFlow', () => ({
  useOnboardingTellerFlow: mockUseOnboardingTellerFlow,
}))
jest.mock('@/hooks/useTellerProviderInfo', () => ({
  useTellerProviderInfo: mockUseTellerProviderInfo,
}))

// Import after mocks so hooks are stubbed
const { OnboardingWizard } = require('@/components/onboarding/OnboardingWizard')
const wizardHookModule = jest.requireMock('@/hooks/useOnboardingWizard')
wizardHookModule.useOnboardingWizard = mockUseOnboardingWizard
const plaidHookModule = jest.requireMock('@/hooks/useOnboardingPlaidFlow')
plaidHookModule.useOnboardingPlaidFlow = mockUseOnboardingPlaidFlow
const tellerHookModule = jest.requireMock('@/hooks/useOnboardingTellerFlow')
tellerHookModule.useOnboardingTellerFlow = mockUseOnboardingTellerFlow
const providerInfoModule = jest.requireMock('@/hooks/useTellerProviderInfo')
providerInfoModule.useTellerProviderInfo = mockUseTellerProviderInfo

describe('OnboardingWizard', () => {
  const mockWizardHook = {
    currentStep: 'welcome' as const,
    stepIndex: 0,
    isComplete: false,
    canGoBack: false,
    canGoNext: true,
    isLastStep: false,
    progress: 50,
    goToNext: jest.fn(),
    goToPrevious: jest.fn(),
    skipWizard: jest.fn(),
    completeWizard: jest.fn(),
  }


  const mockPlaidFlowHook = {
    isConnected: false,
    connectionInProgress: false,
    institutionName: null,
    error: null,
    initiateConnection: jest.fn(),
    handlePlaidSuccess: jest.fn(),
    retryConnection: jest.fn(),
    reset: jest.fn(),
    setError: jest.fn(),
  }

  const mockTellerFlowHook = {
    isConnected: false,
    connectionInProgress: false,
    isSyncing: false,
    institutionName: null,
    error: null,
    initiateConnection: jest.fn(),
    retryConnection: jest.fn(),
    reset: jest.fn(),
    setError: jest.fn(),
  }

  beforeEach(() => {
    cleanup()
    jest.clearAllMocks()
    mockUseOnboardingWizard.mockReturnValue(mockWizardHook as any)
    mockUseOnboardingPlaidFlow.mockReturnValue(mockPlaidFlowHook as any)
    mockUseOnboardingTellerFlow.mockReturnValue(mockTellerFlowHook as any)
    mockUseTellerProviderInfo.mockReturnValue({
      loading: false,
      error: null,
      availableProviders: ['plaid'],
      selectedProvider: 'plaid',
      defaultProvider: 'plaid',
      userProvider: 'plaid',
      tellerApplicationId: null,
      tellerEnvironment: 'development',
      refresh: jest.fn(),
      chooseProvider: jest.fn(),
    })
    mockWelcomeStep.mockClear()
    mockConnectAccountStep.mockClear()
  })

  afterEach(() => {
    cleanup()
    jest.clearAllMocks()
    document.body.innerHTML = ''
  })

  it('given wizard component when rendered then shows current step content', () => {
    const onComplete = jest.fn()

    renderWithTheme(<OnboardingWizard onComplete={onComplete} />)

    expect(screen.getByTestId('welcome-step')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /skip for now/i })).not.toBeInTheDocument()
  })

  it('given wizard at step 2 when rendered then shows simple step info', () => {
    mockUseOnboardingWizard.mockImplementation(() => ({
      ...mockWizardHook,
      currentStep: 'connectAccount',
      stepIndex: 1,
      progress: 100,
    }))

    renderWithTheme(<OnboardingWizard onComplete={jest.fn()} />)

    expect(screen.getByTestId('connect-step')).toBeInTheDocument()
  })

  it('given navigation buttons on welcome when next clicked then advances', () => {
    const mockGoToNext = jest.fn()

    mockUseOnboardingWizard.mockReturnValue({
      ...mockWizardHook,
      currentStep: 'welcome',
      stepIndex: 0,
      canGoBack: false,
      canGoNext: true,
      goToNext: mockGoToNext,
    })


    renderWithTheme(<OnboardingWizard onComplete={jest.fn()} />)

    const nextButton = screen.getByRole('button', { name: 'Continue' })
    expect(nextButton).toBeEnabled()
    fireEvent.click(nextButton)
    expect(mockGoToNext).toHaveBeenCalled()

  })

  it('given connect account step when rendered then shows skip option', () => {
    mockUseOnboardingWizard.mockReturnValue({
      ...mockWizardHook,
      currentStep: 'connectAccount',
      stepIndex: 1,
      isLastStep: true,
    })

    renderWithTheme(<OnboardingWizard onComplete={jest.fn()} />)

    const skipButton = screen.getByRole('button', { name: /skip for now/i })
    fireEvent.click(skipButton)
    expect(mockWizardHook.skipWizard).toHaveBeenCalled()
  })

  it('given final step when plaid connection succeeds then shows get started button', async () => {
    const onComplete = jest.fn()
    const mockCompleteWizard = jest.fn().mockResolvedValue(undefined)

    mockUseOnboardingWizard.mockReturnValue({
      ...mockWizardHook,
      currentStep: 'connectAccount',
      stepIndex: 1,
      isLastStep: true,
      canGoNext: false,
      completeWizard: mockCompleteWizard,
    })

    mockUseOnboardingPlaidFlow.mockReturnValue({
      ...mockPlaidFlowHook,
      isConnected: true,
    })

    renderWithTheme(<OnboardingWizard onComplete={onComplete} />)

    const getStartedButton = screen.getByRole('button', { name: /get started/i })
    expect(getStartedButton).toBeEnabled()

    await act(async () => {
      fireEvent.click(getStartedButton)
    })

    expect(mockCompleteWizard).toHaveBeenCalled()
  })

  it('does not render a complete button on the final step', () => {
    mockUseOnboardingWizard.mockReturnValue({
      ...mockWizardHook,
      currentStep: 'connectAccount',
      stepIndex: 1,
      isLastStep: true,
      canGoNext: false,
    })

    renderWithTheme(<OnboardingWizard onComplete={jest.fn()} />)

    expect(screen.queryByRole('button', { name: /complete/i })).not.toBeInTheDocument()
  })

  it('given wizard when wizard is completed then calls onComplete callback', () => {
    const onComplete = jest.fn()

    mockUseOnboardingWizard.mockReturnValue({
      ...mockWizardHook,
      isComplete: true,
    })

    renderWithTheme(<OnboardingWizard onComplete={onComplete} />)

    expect(onComplete).toHaveBeenCalled()
  })

  it('given wizard when rendered then theme is managed by ThemeProvider (no local dark class)', () => {
    const { container } = renderWithTheme(<OnboardingWizard onComplete={jest.fn()} />)

    const topLevelDiv = container.firstChild as HTMLElement
    expect(topLevelDiv).not.toHaveClass('dark')
  })

})
