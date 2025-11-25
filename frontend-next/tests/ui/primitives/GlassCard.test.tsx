import { render } from '@testing-library/react'
import { GlassCard } from '@/ui/primitives/GlassCard'

describe('GlassCard', () => {
  describe('variants', () => {
    it('renders default variant correctly', () => {
      const { container } = render(
        <GlassCard variant="default">Content</GlassCard>
      )
      const card = container.firstChild as HTMLElement
      expect(card?.className).toMatchSnapshot()
    })

    it('renders auth variant correctly', () => {
      const { container } = render(<GlassCard variant="auth">Content</GlassCard>)
      const card = container.firstChild as HTMLElement
      expect(card?.className).toMatchSnapshot()
    })

    it('renders accent variant correctly', () => {
      const { container } = render(
        <GlassCard variant="accent">Content</GlassCard>
      )
      const card = container.firstChild as HTMLElement
      expect(card?.className).toMatchSnapshot()
    })
  })

  describe('rounded', () => {
    it('renders default rounded correctly', () => {
      const { container } = render(
        <GlassCard rounded="default">Content</GlassCard>
      )
      const card = container.firstChild as HTMLElement
      expect(card?.className).toMatchSnapshot()
    })

    it('renders lg rounded correctly', () => {
      const { container } = render(<GlassCard rounded="lg">Content</GlassCard>)
      const card = container.firstChild as HTMLElement
      expect(card?.className).toMatchSnapshot()
    })

    it('renders xl rounded correctly', () => {
      const { container } = render(<GlassCard rounded="xl">Content</GlassCard>)
      const card = container.firstChild as HTMLElement
      expect(card?.className).toMatchSnapshot()
    })
  })

  describe('padding', () => {
    it('renders no padding correctly', () => {
      const { container } = render(<GlassCard padding="none">Content</GlassCard>)
      const card = container.firstChild as HTMLElement
      expect(card?.className).toMatchSnapshot()
    })

    it('renders sm padding correctly', () => {
      const { container } = render(<GlassCard padding="sm">Content</GlassCard>)
      const card = container.firstChild as HTMLElement
      expect(card?.className).toMatchSnapshot()
    })

    it('renders md padding correctly', () => {
      const { container} = render(<GlassCard padding="md">Content</GlassCard>)
      const card = container.firstChild as HTMLElement
      expect(card?.className).toMatchSnapshot()
    })

    it('renders lg padding correctly', () => {
      const { container } = render(<GlassCard padding="lg">Content</GlassCard>)
      const card = container.firstChild as HTMLElement
      expect(card?.className).toMatchSnapshot()
    })
  })

  describe('withInnerEffects', () => {
    it('renders with inner effects by default', () => {
      const { container } = render(<GlassCard>Content</GlassCard>)
      const innerEffects = container.querySelector('.pointer-events-none')
      expect(innerEffects).toBeTruthy()
    })

    it('renders without inner effects when disabled', () => {
      const { container } = render(
        <GlassCard withInnerEffects={false}>Content</GlassCard>
      )
      const innerEffects = container.querySelector('.pointer-events-none')
      expect(innerEffects).toBeFalsy()
    })
  })

  describe('custom className', () => {
    it('merges containerClassName with variant classes', () => {
      const { container } = render(
        <GlassCard containerClassName="custom-container">Content</GlassCard>
      )
      const card = container.firstChild as HTMLElement
      expect(card?.className).toContain('custom-container')
    })

    it('applies className to inner content wrapper', () => {
      const { container } = render(
        <GlassCard className="custom-content">Content</GlassCard>
      )
      const contentWrapper = container.querySelector('.relative.z-10')
      expect(contentWrapper?.className).toContain('custom-content')
    })
  })
})
