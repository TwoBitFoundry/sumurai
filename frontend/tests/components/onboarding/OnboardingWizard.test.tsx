import { render, screen, fireEvent, act } from '@testing-library/react'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { vi, afterEach } from 'vitest'

// Mock the hooks
vi.mock('@/hooks/useOnboardingWizard')
vi.mock('@/hooks/useOnboardingPlaidFlow')

const mockUseOnboardingWizard = vi.mocked(await import('@/hooks/useOnboardingWizard')).useOnboardingWizard
const mockUseOnboardingPlaidFlow = vi.mocked(await import('@/hooks/useOnboardingPlaidFlow')).useOnboardingPlaidFlow

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

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseOnboardingWizard.mockReturnValue(mockWizardHook)
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
    expect(screen.queryByRole('button', { name: /skip for now/i })).not.toBeInTheDocument()
  })

  it('given wizard at step 2 when rendered then shows progress indicator', () => {
    mockUseOnboardingWizard.mockReturnValue({
      ...mockWizardHook,
      currentStep: 'connectAccount',
      stepIndex: 1,
      progress: 100,
    })

    render(<OnboardingWizard onComplete={vi.fn()} />)

    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('Step 2 of 2')).toBeInTheDocument()
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

    const nextButton = screen.getByRole('button', { name: 'Next' })
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

  it('given final step when plaid connection succeeds then completes automatically', async () => {
    const onComplete = vi.fn()
    const mockCompleteWizard = vi.fn().mockResolvedValue(undefined)
    let capturedOptions: any

    mockUseOnboardingWizard.mockReturnValue({
      ...mockWizardHook,
      currentStep: 'connectAccount',
      stepIndex: 1,
      isLastStep: true,
      canGoNext: false,
      completeWizard: mockCompleteWizard,
    })

    mockUseOnboardingPlaidFlow.mockImplementation((options: any) => {
      capturedOptions = options
      return {
        ...mockPlaidFlowHook,
        isConnected: true,
      }
    })

    render(<OnboardingWizard onComplete={onComplete} />)

    expect(capturedOptions?.onConnectionSuccess).toBeDefined()

    await act(async () => {
      await capturedOptions?.onConnectionSuccess?.('Connected Bank')
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
