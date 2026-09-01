import { Search, X } from 'lucide-solid'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchBar({ value, onChange, placeholder }: Props) {
  return (
    <div class="searchbar">
      <Search class="searchbar__icon" size={16} aria-hidden />
      <input
        type="search"
        class="searchbar__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '검색'}
        aria-label={placeholder ?? '검색'}
      />
      {value && (
        <button
          class="searchbar__clear"
          onClick={() => onChange('')}
          aria-label="검색어 지우기"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
