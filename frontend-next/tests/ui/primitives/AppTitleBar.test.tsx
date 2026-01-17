import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppTitleBar } from '@/ui/primitives/AppTitleBar'

describe('AppTitleBar', () => {
  describe('unauthenticated state', () => {
    it('renders logo', () => {
      render(
        <AppTitleBar
          state="unauthenticated"
          scrolled={false}
          themeMode="light"
          onThemeToggle={() => {}}
        />
      )
      expect(screen.getByText('Sumurai')).toBeInTheDocument()
    })

    it('renders theme toggle button', () => {
      render(
        <AppTitleBar
          state="unauthenticated"
          scrolled={false}
          themeMode="light"
          onThemeToggle={() => {}}
        />
      )
      expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument()
    })

    it('does not render logout button', () => {
      render(
        <AppTitleBar
          state="unauthenticated"
          scrolled={false}
          themeMode="light"
          onThemeToggle={() => {}}
        />
      )
      expect(screen.queryByText('Logout')).not.toBeInTheDocument()
    })

    it('does not render tabs', () => {
      render(
        <AppTitleBar
          state="unauthenticated"
          scrolled={false}
          themeMode="light"
          onThemeToggle={() => {}}
        />
      )
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    })

    it('calls onThemeToggle when theme button clicked', async () => {
      const onThemeToggle = jest.fn()
      const user = userEvent.setup()
      render(
        <AppTitleBar
          state="unauthenticated"
          scrolled={false}
          themeMode="light"
          onThemeToggle={onThemeToggle}
        />
      )
      await user.click(screen.getByLabelText('Toggle theme'))
      expect(onThemeToggle).toHaveBeenCalled()
    })
  })

  describe('onboarding state', () => {
    it('renders logo', () => {
      render(
        <AppTitleBar
          state="onboarding"
          scrolled={false}
          themeMode="light"
          onThemeToggle={() => {}}
          onLogout={() => {}}
        />
      )
      expect(screen.getByText('Sumurai')).toBeInTheDocument()
    })

    it('renders theme toggle button', () => {
      render(
        <AppTitleBar
          state="onboarding"
          scrolled={false}
          themeMode="light"
          onThemeToggle={() => {}}
          onLogout={() => {}}
        />
      )
      expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument()
    })

    it('renders logout button', () => {
      render(
        <AppTitleBar
          state="onboarding"
          scrolled={false}
          themeMode="light"
          onThemeToggle={() => {}}
          onLogout={() => {}}
        />
      )
      expect(screen.getByText('Logout')).toBeInTheDocument()
    })

    it('does not render tabs', () => {
      render(
        <AppTitleBar
          state="onboarding"
          scrolled={false}
          themeMode="light"
          onThemeToggle={() => {}}
          onLogout={() => {}}
        />
      )
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    })

    it('calls onLogout when logout button clicked', async () => {
      const onLogout = jest.fn()
      const user = userEvent.setup()
      render(
        <AppTitleBar
          state="onboarding"
          scrolled={false}
          themeMode="light"
          onThemeToggle={() => {}}
          onLogout={onLogout}
        />
      )
      await user.click(screen.getByText('Logout'))
      expect(onLogout).toHaveBeenCalled()
    })
  })

  describe('authenticated state', () => {
    it('renders logo', () => {
      render(
        <AppTitleBar
          state="authenticated"
          scrolled={false}
          themeMode="light"
          onThemeToggle={() => {}}
          onLogout={() => {}}
          currentTab="dashboard"
          onTabChange={() => {}}
        />
      )
      expect(screen.getByText('Sumurai')).toBeInTheDocument()
    })

    it('renders all tabs', () => {
      render(
        <AppTitleBar
          state="authenticated"
          scrolled={false}
          themeMode="light"
          onThemeToggle={() => {}}
          onLogout={() => {}}
          currentTab="dashboard"
          onTabChange={() => {}}
        />
      )
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Transactions')).toBeInTheDocument()
      expect(screen.getByText('Budgets')).toBeInTheDocument()
      expect(screen.getByText('Accounts')).toBeInTheDocument()
    })

    it('renders theme toggle button', () => {
      render(
        <AppTitleBar
          state="authenticated"
          scrolled={false}
          themeMode="light"
          onThemeToggle={() => {}}
          onLogout={() => {}}
          currentTab="dashboard"
          onTabChange={() => {}}
        />
      )
      expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument()
    })

    it('renders logout button', () => {
      render(
        <AppTitleBar
          state="authenticated"
          scrolled={false}
          themeMode="light"
          onThemeToggle={() => {}}
          onLogout={() => {}}
          currentTab="dashboard"
          onTabChange={() => {}}
        />
      )
      expect(screen.getByText('Logout')).toBeInTheDocument()
    })

    it('renders account filter node when provided', () => {
      render(
        <AppTitleBar
          state="authenticated"
          scrolled={false}
          themeMode="light"
          onThemeToggle={() => {}}
          onLogout={() => {}}
          currentTab="dashboard"
          onTabChange={() => {}}
          accountFilterNode={<div>Account Filter</div>}
        />
      )
      expect(screen.getByText('Account Filter')).toBeInTheDocument()
    })

    it('calls onTabChange when tab clicked', async () => {
      const onTabChange = jest.fn()
      const user = userEvent.setup()
      render(
        <AppTitleBar
          state="authenticated"
          scrolled={false}
          themeMode="light"
          onThemeToggle={() => {}}
          onLogout={() => {}}
          currentTab="dashboard"
          onTabChange={onTabChange}
        />
      )
      await user.click(screen.getByText('Transactions'))
      expect(onTabChange).toHaveBeenCalledWith('transactions')
    })

    it('highlights active tab', () => {
      const { container } = render(
        <AppTitleBar
          state="authenticated"
          scrolled={false}
          themeMode="light"
          onThemeToggle={() => {}}
          onLogout={() => {}}
          currentTab="dashboard"
          onTabChange={() => {}}
        />
      )
      const buttons = container.querySelectorAll('button')
      const dashboardButton = Array.from(buttons).find(b => b.textContent === 'Dashboard')
      expect(dashboardButton?.className).toContain('bg-[linear-gradient(115deg,#38bdf8_0%,#22d3ee_46%,#a855f7_100%)]')
    })
  })

  describe('scroll state variants', () => {
    it('renders h-16 when not scrolled', () => {
      const { container } = render(
        <AppTitleBar
          state="unauthenticated"
          scrolled={false}
          themeMode="light"
          onThemeToggle={() => {}}
        />
      )
      const header = container.querySelector('header')
      expect(header?.className).toContain('h-16')
    })

    it('renders h-14 when scrolled', () => {
      const { container } = render(
        <AppTitleBar
          state="unauthenticated"
          scrolled={true}
          themeMode="light"
          onThemeToggle={() => {}}
        />
      )
      const header = container.querySelector('header')
      expect(header?.className).toContain('h-14')
    })
  })

  describe('theme mode', () => {
    it('renders with light mode styles', () => {
      const { container } = render(
        <AppTitleBar
          state="unauthenticated"
          scrolled={false}
          themeMode="light"
          onThemeToggle={() => {}}
        />
      )
      const header = container.querySelector('header')
      expect(header?.className).toContain('bg-white/80')
    })

    it('renders with dark mode styles', () => {
      const { container } = render(
        <AppTitleBar
          state="unauthenticated"
          scrolled={false}
          themeMode="dark"
          onThemeToggle={() => {}}
        />
      )
      const header = container.querySelector('header')
      expect(header?.className).toContain('dark:bg-slate-800/80')
    })
  })

  describe('snapshots', () => {
    it('matches snapshot for unauthenticated state', () => {
      const { container } = render(
        <AppTitleBar
          state="unauthenticated"
          scrolled={false}
          themeMode="light"
          onThemeToggle={() => {}}
        />
      )
      expect(container.firstChild).toMatchSnapshot()
    })

    it('matches snapshot for onboarding state', () => {
      const { container } = render(
        <AppTitleBar
          state="onboarding"
          scrolled={false}
          themeMode="light"
          onThemeToggle={() => {}}
          onLogout={() => {}}
        />
      )
      expect(container.firstChild).toMatchSnapshot()
    })

    it('matches snapshot for authenticated state', () => {
      const { container } = render(
        <AppTitleBar
          state="authenticated"
          scrolled={false}
          themeMode="light"
          onThemeToggle={() => {}}
          onLogout={() => {}}
          currentTab="dashboard"
          onTabChange={() => {}}
        />
      )
      expect(container.firstChild).toMatchSnapshot()
    })
  })
})
