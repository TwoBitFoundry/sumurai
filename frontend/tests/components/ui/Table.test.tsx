import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Th, Td } from '@/components/ui/Table'

describe('Table atoms', () => {
  it('renders Th and Td with semantics', () => {
    render(
      <table>
        <thead><tr><Th>H1</Th></tr></thead>
        <tbody><tr><Td>C1</Td></tr></tbody>
      </table>
    )
    expect(screen.getByText('H1').tagName).toBe('TH')
    expect(screen.getByText('C1').tagName).toBe('TD')
  })
})
