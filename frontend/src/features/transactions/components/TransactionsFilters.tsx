import React from 'react'
import { getTagThemeForCategory } from '../../../utils/categories'

interface Props {
  search: string
  onSearch: (s: string) => void
  categories: string[]
  selectedCategory: string | null
  onSelectCategory: (c: string | null) => void
  showSearch?: boolean
  showCategories?: boolean
}

export const TransactionsFilters: React.FC<Props> = ({
  search,
  onSearch,
  categories,
  selectedCategory,
  onSelectCategory,
  showSearch = true,
  showCategories = true,
}) => {
  return (
    <>
      {showSearch && (
        <div className="relative w-full max-w-sm ml-auto">
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search transactions"
            className="w-full pl-3 pr-3 py-2 rounded-2xl bg-white/10 border border-white/15 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
          />
        </div>
      )}
      {showCategories && (
        <div className="flex flex-wrap items-center gap-2 pl-1 w-full">
          {categories.map((name) => {
            const isSelected = selectedCategory === name
            const theme = getTagThemeForCategory(name)
            return (
              <button
                key={name}
                type="button"
                onClick={() => onSelectCategory(isSelected ? null : name)}
                className={`px-2 py-1 rounded-full text-xs transition inline-flex items-center gap-2 ${theme.tag} ${isSelected ? `ring-2 ${theme.ring}` : 'hover:opacity-90'}`}
                aria-pressed={isSelected}
                title={isSelected ? `Remove filter: ${name}` : `Filter by ${name}`}
              >
                ● {name}
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}

export default TransactionsFilters
