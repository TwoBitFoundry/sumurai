import React from 'react'

interface Props {
  search: string
  onSearch: (s: string) => void
  categories: string[]
  selectedCategory: string | null
  onSelectCategory: (c: string | null) => void
}

export const TransactionsFilters: React.FC<Props> = ({ search, onSearch, categories, selectedCategory, onSelectCategory }) => {
  return (
    <>
      <div className="relative w-full max-w-sm">
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search transactions"
          className="w-full pl-3 pr-3 py-2 rounded-2xl bg-white/10 border border-white/15 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-1">
        {categories.map((name) => {
          const isSelected = selectedCategory === name
          return (
            <button
              key={name}
              type="button"
              onClick={() => onSelectCategory(isSelected ? null : name)}
              className={`px-2 py-1 rounded-full text-xs border transition ${isSelected ? 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              aria-pressed={isSelected}
              title={isSelected ? `Remove filter: ${name}` : `Filter by ${name}`}
            >
              {name}
            </button>
          )
        })}
      </div>
    </>
  )
}

export default TransactionsFilters

