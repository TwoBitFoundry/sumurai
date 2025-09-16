import { render, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import ConnectButton from './ConnectButton'

describe('ConnectButton', () => {
  it('renders label and triggers onClick', () => {
    const onClick = vi.fn()
    const { getByRole } = render(<ConnectButton onClick={onClick} />)

    const button = getByRole('button', { name: /add bank/i })
    fireEvent.click(button)

    expect(onClick).toHaveBeenCalled()
  })

  it('supports secondary variant', () => {
    const { getAllByRole } = render(<ConnectButton onClick={() => {}} variant="secondary" />)

    const buttons = getAllByRole('button', { name: /add bank/i })
    const button = buttons[buttons.length - 1]
    expect(button.className).toContain('border')
  })
})
