import { render } from '@testing-library/react'
import { Input } from '@/ui/primitives/Input'

describe('Input', () => {
  describe('variants', () => {
    it('renders default variant correctly', () => {
      const { container } = render(<Input variant="default" />)
      const input = container.querySelector('input')
      expect(input?.className).toMatchSnapshot()
    })

    it('renders invalid variant correctly', () => {
      const { container } = render(<Input variant="invalid" />)
      const input = container.querySelector('input')
      expect(input?.className).toMatchSnapshot()
    })

    it('renders glass variant correctly', () => {
      const { container } = render(<Input variant="glass" />)
      const input = container.querySelector('input')
      expect(input?.className).toMatchSnapshot()
    })
  })

  describe('sizes', () => {
    it('renders sm size correctly', () => {
      const { container } = render(<Input inputSize="sm" />)
      const input = container.querySelector('input')
      expect(input?.className).toMatchSnapshot()
    })

    it('renders md size correctly', () => {
      const { container } = render(<Input inputSize="md" />)
      const input = container.querySelector('input')
      expect(input?.className).toMatchSnapshot()
    })

    it('renders lg size correctly', () => {
      const { container } = render(<Input inputSize="lg" />)
      const input = container.querySelector('input')
      expect(input?.className).toMatchSnapshot()
    })
  })

  describe('states', () => {
    it('renders disabled state correctly', () => {
      const { container } = render(<Input disabled />)
      const input = container.querySelector('input')
      expect(input?.disabled).toBe(true)
    })
  })

  describe('custom className', () => {
    it('merges custom className with variant classes', () => {
      const { container } = render(
        <Input variant="default" className="custom-class" />
      )
      const input = container.querySelector('input')
      expect(input?.className).toContain('custom-class')
    })
  })
})
