import { Search, X } from 'lucide-solid'
import { Show } from 'solid-js'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchBar(props: Props) {
  return (
    <div class="searchbar">
      <Search class="searchbar__icon" size={16} aria-hidden />
      <input
        type="search"
        class="searchbar__input"
        value={props.value}
        onInput={(e) => props.onChange(e.currentTarget.value)}
        placeholder={props.placeholder ?? '검색'}
        aria-label={props.placeholder ?? '검색'}
      />
      <Show when={props.value}>
        <button
          class="searchbar__clear"
          onClick={() => props.onChange('')}
          aria-label="검색어 지우기"
        >
          <X size={16} />
        </button>
      </Show>
    </div>
  )
}
