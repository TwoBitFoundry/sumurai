import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { vi, beforeEach, afterEach } from 'vitest'

// Mock the hooks
vi.mock('@/hooks/useOnboardingWizard')
vi.mock('@/hooks/useOnboardingPlaidFlow')
vi.mock('@/hooks/useOnboardingTellerFlow')
vi.mock('@/hooks/useTellerProviderInfo')

// Mock boundary components so copy tweaks do not break contract tests
const { mockWelcomeStep, mockConnectAccountStep } = vi.hoisted(() => ({
  mockWelcomeStep: vi.fn(() => <div data-testid="welcome-step">Welcome Step</div>),
  mockConnectAccountStep: vi.fn(() => <div data-testid="connect-step">Connect Step</div>),
}))

vi.mock('@/components/onboarding/WelcomeStep', () => ({
  WelcomeStep: mockWelcomeStep,
}))

vi.mock('@/components/onboarding/ConnectAccountStep', () => {
  const baseContent = {
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
    securityNote: '',
  }

  return {
    ConnectAccountStep: mockConnectAccountStep,
    CONNECT_ACCOUNT_PROVIDER_CONTENT: {
      plaid: {
        ...baseContent,
        displayName: 'Plaid',
        securityNote: 'Plaid security note',
      },
      teller: {
        ...baseContent,
        displayName: 'Teller',
        securityNote: 'Teller security note',
        requiresApplicationId: true,
      },
    },
  }
})

const mockUseOnboardingWizard = vi.mocked(await import('@/hooks/useOnboardingWizard')).useOnboardingWizard
const mockUseOnboardingPlaidFlow = vi.mocked(await import('@/hooks/useOnboardingPlaidFlow')).useOnboardingPlaidFlow
const mockUseOnboardingTellerFlow = vi.mocked(await import('@/hooks/useOnboardingTellerFlow')).useOnboardingTellerFlow
const mockUseTellerProviderInfo = vi.mocked(await import('@/hooks/useTellerProviderInfo')).useTellerProviderInfo

describe('OnboardingWizard', () => {
  const mockWizardHook = {
    currentStep: 'welcome' as const,
    stepIndex: 0,
    isComplete: false,
    canGoBack: false,
    canGoNext: true,
    isLastStep: false,
    progress: 50,
    goToNext: vi.fn(),
    goToPrevious: vi.fn(),
    skipWizard: vi.fn(),
    completeWizard: vi.fn(),
  }


  const mockPlaidFlowHook = {
    isConnected: false,
    connectionInProgress: false,
    institutionName: null,
    error: null,
    initiateConnection: vi.fn(),
    handlePlaidSuccess: vi.fn(),
    retryConnection: vi.fn(),
    reset: vi.fn(),
    setError: vi.fn(),
  }

  const mockTellerFlowHook = {
    isConnected: false,
    connectionInProgress: false,
    isSyncing: false,
    institutionName: null,
    error: null,
    initiateConnection: vi.fn(),
    retryConnection: vi.fn(),
    reset: vi.fn(),
    setError: vi.fn(),
  }

  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    mockUseOnboardingWizard.mockReturnValue(mockWizardHook)
    mockUseOnboardingPlaidFlow.mockReturnValue(mockPlaidFlowHook)
    mockUseOnboardingTellerFlow.mockReturnValue(mockTellerFlowHook)
    mockUseTellerProviderInfo.mockReturnValue({
      loading: false,
      error: null,
      availableProviders: ['plaid'],
      selectedProvider: 'plaid',
      defaultProvider: 'plaid',
      userProvider: 'plaid',
      tellerApplicationId: null,
      tellerEnvironment: 'development',
      refresh: vi.fn(),
      chooseProvider: vi.fn(),
    })
    mockWelcomeStep.mockClear()
    mockConnectAccountStep.mockClear()
  })

  afterEach(() => {
    cleanup()
    vi.resetAllMocks()
    document.body.innerHTML = ''
  })

  it('given wizard component when rendered then shows current step content', () => {
    const onComplete = vi.fn()

    render(<OnboardingWizard onComplete={onComplete} />)

    expect(screen.getByTestId('welcome-step')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /skip for now/i })).not.toBeInTheDocument()
  })

  it('given wizard at step 2 when rendered then shows simple step info', () => {
    mockUseOnboardingWizard.mockReturnValue({
      ...mockWizardHook,
      currentStep: 'connectAccount',
      stepIndex: 1,
      progress: 100,
    })

    render(<OnboardingWizard onComplete={vi.fn()} />)

    expect(screen.getByTestId('connect-step')).toBeInTheDocument()
  })

  it('given navigation buttons on welcome when next clicked then advances', () => {
    const mockGoToNext = vi.fn()

    mockUseOnboardingWizard.mockReturnValue({
      ...mockWizardHook,
      currentStep: 'welcome',
      stepIndex: 0,
      canGoBack: false,
      canGoNext: true,
      goToNext: mockGoToNext,
    })


    render(<OnboardingWizard onComplete={vi.fn()} />)

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

    render(<OnboardingWizard onComplete={vi.fn()} />)

    const skipButton = screen.getByRole('button', { name: /skip for now/i })
    fireEvent.click(skipButton)
    expect(mockWizardHook.skipWizard).toHaveBeenCalled()
  })

  it('given final step when plaid connection succeeds then shows get started button', async () => {
    const onComplete = vi.fn()
    const mockCompleteWizard = vi.fn().mockResolvedValue(undefined)

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

    render(<OnboardingWizard onComplete={onComplete} />)

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

    render(<OnboardingWizard onComplete={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /complete/i })).not.toBeInTheDocument()
  })

  it('given wizard when wizard is completed then calls onComplete callback', () => {
    const onComplete = vi.fn()

    mockUseOnboardingWizard.mockReturnValue({
      ...mockWizardHook,
      isComplete: true,
    })

    render(<OnboardingWizard onComplete={onComplete} />)

    expect(onComplete).toHaveBeenCalled()
  })

  it('given wizard when dark mode prop passed then applies correct theme classes', () => {
    const { container } = render(<OnboardingWizard onComplete={vi.fn()} dark={true} />)

    expect(container.firstChild).toHaveClass('dark')
  })
})
