import { render, screen } from '@testing-library/react'
import { AppFooter } from '@/ui/primitives/AppFooter'

describe('AppFooter', () => {
  it('renders footer component', () => {
    const { container } = render(<AppFooter />)
    expect(container.querySelector('footer')).toBeInTheDocument()
  })

  it('has w-full wrapper class', () => {
    const { container } = render(<AppFooter />)
    const wrapper = container.firstChild
    expect(wrapper).toHaveClass('w-full')
  })

  it('renders footer branding', () => {
    render(<AppFooter />)
    expect(screen.getByAltText('Two Bit Foundry')).toBeInTheDocument()
    expect(screen.getByText('Built in the open with the community')).toBeInTheDocument()
  })

  it('renders action buttons', () => {
    render(<AppFooter />)
    expect(screen.getByText('Forge with us')).toBeInTheDocument()
    expect(screen.getByText('Buy us a coffee')).toBeInTheDocument()
    expect(screen.getByText('Star us on GitHub')).toBeInTheDocument()
  })

  it('renders footer links', () => {
    render(<AppFooter />)
    expect(screen.getByText('Contact')).toBeInTheDocument()
    expect(screen.getByText('Support')).toBeInTheDocument()
  })

  it('renders copyright notice', () => {
    render(<AppFooter />)
    const year = new Date().getFullYear()
    expect(screen.getByText(new RegExp(`© ${year}`))).toBeInTheDocument()
  })

  it('matches snapshot', () => {
    const { container } = render(<AppFooter />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
