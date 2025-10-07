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
        <div className="relative w-full sm:w-64">
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search transactions..."
            className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)] transition-all duration-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-white dark:border-white/12 dark:bg-[#111a2f] dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-sky-400/80 dark:focus:ring-offset-[#0f172a]"
          />
        </div>
      )}
      {showCategories && (
        <div className="flex w-full items-center gap-3">
          <span className="flex-shrink-0 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-slate-500 transition-colors duration-500 dark:text-slate-400">
            Filter
          </span>
          <div className="relative min-w-0 flex-1">
            <div
              ref={scrollContainerRef}
              onScroll={checkScroll}
              className="scrollbar-hide flex items-center gap-2 overflow-x-auto pb-1 pl-1 pt-1"
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
                    className={`inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 transition-all duration-150 backdrop-blur-sm ring-1 ring-white/60 dark:ring-white/10 ${theme.tag} ${
                      isSelected ? `ring-2 ${theme.ring}` : 'hover:-translate-y-[2px] hover:shadow-lg'
                    }`}
                    aria-pressed={isSelected}
                    title={isSelected ? `Remove filter: ${name}` : `Filter by ${name}`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.85)] dark:shadow-[0_0_0_1px_rgba(15,23,42,0.7)] ${theme.dot}`}
                      aria-hidden="true"
                    />
                    {name}
                  </button>
                )
              })}
            </div>
            {showLeftFade && (
              <div className="pointer-events-none absolute bottom-0 left-0 top-0 w-8 bg-gradient-to-r from-white to-transparent transition-opacity duration-200 dark:from-[#0f172a]" />
            )}
            {showRightFade && (
              <div className="pointer-events-none absolute bottom-0 right-0 top-0 w-8 bg-gradient-to-l from-white to-transparent transition-opacity duration-200 dark:from-[#0f172a]" />
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default TransactionsFilters
