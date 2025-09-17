import { render, screen, fireEvent } from '@testing-library/react'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { vi, afterEach } from 'vitest'

// Mock the hooks
vi.mock('@/hooks/useOnboardingWizard')
vi.mock('@/hooks/useOnboardingPreferences')
vi.mock('@/hooks/useOnboardingPlaidFlow')

const mockUseOnboardingWizard = vi.mocked(await import('@/hooks/useOnboardingWizard')).useOnboardingWizard
const mockUseOnboardingPreferences = vi.mocked(await import('@/hooks/useOnboardingPreferences')).useOnboardingPreferences
const mockUseOnboardingPlaidFlow = vi.mocked(await import('@/hooks/useOnboardingPlaidFlow')).useOnboardingPlaidFlow

describe('OnboardingWizard', () => {
  const mockWizardHook = {
    currentStep: 'welcome' as const,
    stepIndex: 0,
    isComplete: false,
    canGoBack: false,
    canGoNext: true,
    isLastStep: false,
    progress: 33,
    goToNext: vi.fn(),
    goToPrevious: vi.fn(),
    skipWizard: vi.fn(),
    completeWizard: vi.fn(),
  }

  const mockPreferencesHook = {
    preferences: { enableMockData: false },
    hasSetPreferences: false,
    setMockDataEnabled: vi.fn(),
    savePreferences: vi.fn(),
    applyPreferences: vi.fn(),
    resetPreferences: vi.fn(),
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

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseOnboardingWizard.mockReturnValue(mockWizardHook)
    mockUseOnboardingPreferences.mockReturnValue(mockPreferencesHook)
    mockUseOnboardingPlaidFlow.mockReturnValue(mockPlaidFlowHook)
  })

  afterEach(() => {
    vi.resetAllMocks()
    document.body.innerHTML = ''
  })

  it('given wizard component when rendered then shows current step content', () => {
    const onComplete = vi.fn()

    render(<OnboardingWizard onComplete={onComplete} />)

    expect(screen.getByText(/welcome to sumaura/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /skip for now/i })).toBeInTheDocument()
  })

  it('given wizard at step 2 when rendered then shows progress indicator', () => {
    mockUseOnboardingWizard.mockReturnValue({
      ...mockWizardHook,
      currentStep: 'mockData',
      stepIndex: 1,
      progress: 67,
    })

    render(<OnboardingWizard onComplete={vi.fn()} />)

    expect(screen.getByText('67%')).toBeInTheDocument()
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument()
  })

  it('given navigation buttons when clicked then calls hook methods', () => {
    const mockGoToNext = vi.fn()
    const mockSkipWizard = vi.fn()

    mockUseOnboardingWizard.mockReturnValue({
      ...mockWizardHook,
      currentStep: 'welcome',
      stepIndex: 0,
      canGoBack: false,
      canGoNext: true,
      goToNext: mockGoToNext,
      skipWizard: mockSkipWizard,
    })

    mockUseOnboardingPreferences.mockReturnValue({
      ...mockPreferencesHook,
      hasSetPreferences: false,
    })

    render(<OnboardingWizard onComplete={vi.fn()} />)

    const nextButton = screen.getByRole('button', { name: 'Next' })
    expect(nextButton).toBeEnabled()
    fireEvent.click(nextButton)
    expect(mockGoToNext).toHaveBeenCalled()

    const skipButton = screen.getByRole('button', { name: 'Skip for now' })
    fireEvent.click(skipButton)
    expect(mockSkipWizard).toHaveBeenCalled()
  })

  it('given any step when rendered then shows skip option', () => {
    mockUseOnboardingWizard.mockReturnValue({
      ...mockWizardHook,
      currentStep: 'welcome',
      stepIndex: 0,
    })

    render(<OnboardingWizard onComplete={vi.fn()} />)

    const skipButtons = screen.getAllByRole('button', { name: /skip for now/i })
    expect(skipButtons.length).toBeGreaterThan(0)
  })

  it('given last step when complete button clicked then calls completion handlers', () => {
    const onComplete = vi.fn()
    const mockCompleteWizard = vi.fn()

    mockUseOnboardingWizard.mockReturnValue({
      ...mockWizardHook,
      currentStep: 'connectAccount',
      stepIndex: 2,
      isLastStep: true,
      canGoNext: false,
      completeWizard: mockCompleteWizard,
    })

    mockUseOnboardingPreferences.mockReturnValue({
      ...mockPreferencesHook,
      preferences: { enableMockData: true },
      hasSetPreferences: true,
    })

    render(<OnboardingWizard onComplete={onComplete} />)

    fireEvent.click(screen.getByRole('button', { name: /complete/i }))

    expect(mockCompleteWizard).toHaveBeenCalled()
    expect(onComplete).toHaveBeenCalled()
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