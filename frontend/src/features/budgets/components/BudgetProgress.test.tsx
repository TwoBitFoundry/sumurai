import { render } from '@testing-library/react'
import { BudgetProgress } from './BudgetProgress'

describe('BudgetProgress', () => {
  it('renders percent and over/under text', () => {
    const { getByText } = render(
      <BudgetProgress amount={200} spent={150} />
    )
    expect(getByText(/75% used/)).toBeInTheDocument()
  })
})

