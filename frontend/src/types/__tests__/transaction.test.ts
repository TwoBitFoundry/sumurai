import { describe, it, expectTypeOf } from 'vitest'
import type { Transaction } from '../api'

type Expect<T extends true> = T
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false

describe('Transaction type', () => {
  it('models provider-aware categorization', () => {
    type CategoryShape = Transaction['category']
    type ProviderField = Transaction['provider']

    type _CategoryPrimary = Expect<Equal<CategoryShape['primary'], string>>
    type _CategoryDetailed = Expect<Equal<CategoryShape['detailed'], string | undefined>>
    type _CategoryConfidence = Expect<Equal<CategoryShape['confidence_level'], string | undefined>>
    type _Provider = Expect<Equal<ProviderField, 'plaid' | 'teller'>>

    expectTypeOf<CategoryShape>().toBeObject()
    expectTypeOf<ProviderField>().toMatchTypeOf<'plaid' | 'teller'>()
  })

  it('tracks Teller specific metadata', () => {
    type RunningBalance = Transaction['running_balance']
    type _RunningBalance = Expect<Equal<RunningBalance, number | undefined>>

    expectTypeOf<RunningBalance>().toMatchTypeOf<number | undefined>()
  })
})
