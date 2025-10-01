import React, { useRef, useState, useEffect } from 'react'
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
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showLeftFade, setShowLeftFade] = useState(false)
  const [showRightFade, setShowRightFade] = useState(false)

  const checkScroll = () => {
    const el = scrollContainerRef.current
    if (!el) return

    setShowLeftFade(el.scrollLeft > 0)
    setShowRightFade(el.scrollLeft < el.scrollWidth - el.clientWidth - 1)
  }

  useEffect(() => {
    checkScroll()
    window.addEventListener('resize', checkScroll)
    return () => window.removeEventListener('resize', checkScroll)
  }, [categories])

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
        <div className="relative w-full">
          <div
            ref={scrollContainerRef}
            onScroll={checkScroll}
            className="flex items-center gap-2 pl-1 w-full overflow-x-auto scrollbar-hide pb-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {categories.map((name) => {
              const isSelected = selectedCategory === name
              const theme = getTagThemeForCategory(name)
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => onSelectCategory(isSelected ? null : name)}
                  className={`px-2 py-1 rounded-full text-xs transition inline-flex items-center gap-2 whitespace-nowrap flex-shrink-0 ${theme.tag} ${isSelected ? `ring-2 ${theme.ring}` : 'hover:opacity-90'}`}
                  aria-pressed={isSelected}
                  title={isSelected ? `Remove filter: ${name}` : `Filter by ${name}`}
                >
                  ● {name}
                </button>
              )
            })}
          </div>
          {showLeftFade && (
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white dark:from-slate-900 to-transparent pointer-events-none" />
          )}
          {showRightFade && (
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-slate-900 to-transparent pointer-events-none" />
          )}
        </div>
      )}
    </>
  )
}

export default TransactionsFilters
