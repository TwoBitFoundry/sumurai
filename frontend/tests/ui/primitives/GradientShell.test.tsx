import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { GradientShell } from '@/ui/primitives/GradientShell'

describe('GradientShell', () => {
  describe('variants', () => {
    it('renders auth variant correctly', () => {
      const { container } = render(
        <GradientShell variant="auth">Content</GradientShell>
      )
      const shell = container.firstChild as HTMLElement
      expect(shell?.className).toMatchSnapshot()
    })

    it('renders app variant correctly', () => {
      const { container } = render(
        <GradientShell variant="app">Content</GradientShell>
      )
      const shell = container.firstChild as HTMLElement
      expect(shell?.className).toMatchSnapshot()
    })
  })

  describe('default props', () => {
    it('uses auth variant by default', () => {
      const { container } = render(<GradientShell>Content</GradientShell>)
      const shell = container.firstChild as HTMLElement
      expect(shell?.className).toContain('min-h-[calc(100vh-4rem)]')
    })
  })

  describe('custom className', () => {
    it('merges custom className with variant classes', () => {
      const { container } = render(
        <GradientShell className="custom-class">Content</GradientShell>
      )
      const shell = container.firstChild as HTMLElement
      expect(shell?.className).toContain('custom-class')
    })
  })

  describe('structure', () => {
    it('renders aura background elements', () => {
      const { container } = render(<GradientShell>Content</GradientShell>)
      const auras = container.querySelectorAll('.pointer-events-none')
      expect(auras.length).toBeGreaterThan(0)
    })

    it('renders content wrapper', () => {
      const { getByText } = render(<GradientShell>Test Content</GradientShell>)
      expect(getByText('Test Content')).toBeTruthy()
    })
  })
})
