import { Search, X } from 'lucide-react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchBar({ value, onChange, placeholder }: Props) {
  return (
    <div className="searchbar">
      <Search className="searchbar__icon" size={16} aria-hidden />
      <input
        type="search"
        className="searchbar__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '검색'}
        aria-label={placeholder ?? '검색'}
      />
      {value && (
        <button
          className="searchbar__clear"
          onClick={() => onChange('')}
          aria-label="검색어 지우기"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
