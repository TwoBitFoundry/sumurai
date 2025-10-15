import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Button } from '@/ui/primitives/Button'

describe('Button', () => {
  describe('variants', () => {
    it('renders primary variant correctly', () => {
      const { container } = render(<Button variant="primary">Primary</Button>)
      const button = container.querySelector('button')
      expect(button?.className).toMatchSnapshot()
    })

    it('renders secondary variant correctly', () => {
      const { container } = render(<Button variant="secondary">Secondary</Button>)
      const button = container.querySelector('button')
      expect(button?.className).toMatchSnapshot()
    })

    it('renders ghost variant correctly', () => {
      const { container } = render(<Button variant="ghost">Ghost</Button>)
      const button = container.querySelector('button')
      expect(button?.className).toMatchSnapshot()
    })

    it('renders icon variant correctly', () => {
      const { container } = render(<Button variant="icon">Icon</Button>)
      const button = container.querySelector('button')
      expect(button?.className).toMatchSnapshot()
    })

    it('renders danger variant correctly', () => {
      const { container } = render(<Button variant="danger">Danger</Button>)
      const button = container.querySelector('button')
      expect(button?.className).toMatchSnapshot()
    })

    it('renders success variant correctly', () => {
      const { container } = render(<Button variant="success">Success</Button>)
      const button = container.querySelector('button')
      expect(button?.className).toMatchSnapshot()
    })

    it('renders connect variant correctly', () => {
      const { container } = render(<Button variant="connect">Connect</Button>)
      const button = container.querySelector('button')
      expect(button?.className).toMatchSnapshot()
    })

    it('renders tab variant correctly', () => {
      const { container } = render(<Button variant="tab">Tab</Button>)
      const button = container.querySelector('button')
      expect(button?.className).toMatchSnapshot()
    })

    it('renders tabActive variant correctly', () => {
      const { container } = render(<Button variant="tabActive">Active Tab</Button>)
      const button = container.querySelector('button')
      expect(button?.className).toMatchSnapshot()
    })
  })

  describe('sizes', () => {
    it('renders xs size correctly', () => {
      const { container } = render(<Button size="xs">XS</Button>)
      const button = container.querySelector('button')
      expect(button?.className).toMatchSnapshot()
    })

    it('renders sm size correctly', () => {
      const { container } = render(<Button size="sm">SM</Button>)
      const button = container.querySelector('button')
      expect(button?.className).toMatchSnapshot()
    })

    it('renders md size correctly', () => {
      const { container } = render(<Button size="md">MD</Button>)
      const button = container.querySelector('button')
      expect(button?.className).toMatchSnapshot()
    })

    it('renders lg size correctly', () => {
      const { container } = render(<Button size="lg">LG</Button>)
      const button = container.querySelector('button')
      expect(button?.className).toMatchSnapshot()
    })

    it('renders icon size correctly', () => {
      const { container } = render(<Button size="icon">I</Button>)
      const button = container.querySelector('button')
      expect(button?.className).toMatchSnapshot()
    })
  })

  describe('states', () => {
    it('renders loading state correctly', () => {
      const { container } = render(<Button loading>Loading</Button>)
      const button = container.querySelector('button')
      expect(button?.disabled).toBe(true)
    })

    it('renders disabled state correctly', () => {
      const { container } = render(<Button disabled>Disabled</Button>)
      const button = container.querySelector('button')
      expect(button?.disabled).toBe(true)
    })
  })

  describe('custom className', () => {
    it('merges custom className with variant classes', () => {
      const { container } = render(
        <Button variant="primary" className="custom-class">
          Custom
        </Button>
      )
      const button = container.querySelector('button')
      expect(button?.className).toContain('custom-class')
    })
  })
})
