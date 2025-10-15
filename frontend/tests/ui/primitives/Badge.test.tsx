import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Badge } from '@/ui/primitives/Badge'

describe('Badge', () => {
  describe('variants', () => {
    it('renders default variant correctly', () => {
      const { container } = render(<Badge variant="default">Default</Badge>)
      const badge = container.querySelector('span')
      expect(badge?.className).toMatchSnapshot()
    })

    it('renders primary variant correctly', () => {
      const { container } = render(<Badge variant="primary">Primary</Badge>)
      const badge = container.querySelector('span')
      expect(badge?.className).toMatchSnapshot()
    })

    it('renders feature variant correctly', () => {
      const { container } = render(<Badge variant="feature">Feature</Badge>)
      const badge = container.querySelector('span')
      expect(badge?.className).toMatchSnapshot()
    })
  })

  describe('sizes', () => {
    it('renders xs size correctly', () => {
      const { container } = render(<Badge size="xs">XS</Badge>)
      const badge = container.querySelector('span')
      expect(badge?.className).toMatchSnapshot()
    })

    it('renders sm size correctly', () => {
      const { container } = render(<Badge size="sm">SM</Badge>)
      const badge = container.querySelector('span')
      expect(badge?.className).toMatchSnapshot()
    })

    it('renders md size correctly', () => {
      const { container } = render(<Badge size="md">MD</Badge>)
      const badge = container.querySelector('span')
      expect(badge?.className).toMatchSnapshot()
    })

    it('renders lg size correctly', () => {
      const { container } = render(<Badge size="lg">LG</Badge>)
      const badge = container.querySelector('span')
      expect(badge?.className).toMatchSnapshot()
    })
  })

  describe('custom className', () => {
    it('merges custom className with variant classes', () => {
      const { container } = render(
        <Badge variant="default" className="custom-class">
          Custom
        </Badge>
      )
      const badge = container.querySelector('span')
      expect(badge?.className).toContain('custom-class')
    })
  })
})
