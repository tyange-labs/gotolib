import { Search, X } from 'lucide-solid'
import { Show } from 'solid-js'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** 엔터(모바일 키보드의 '검색')를 눌렀을 때 */
  onSubmit?: () => void
  /** 바깥에서 포커스를 줄 수 있게 입력 요소를 넘겨준다 */
  inputRef?: (element: HTMLInputElement) => void
}

export function SearchBar(props: Props) {
  return (
    <form
      class="searchbar"
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        props.onSubmit?.()
      }}
    >
      <Search class="searchbar__icon" size={16} aria-hidden />
      <input
        ref={(element) => props.inputRef?.(element)}
        type="search"
        enterkeyhint="search"
        class="searchbar__input"
        value={props.value}
        onInput={(e) => props.onChange(e.currentTarget.value)}
        placeholder={props.placeholder ?? '검색'}
        aria-label={props.placeholder ?? '검색'}
      />
      <Show when={props.value}>
        <button
          type="button"
          class="searchbar__clear"
          onClick={() => props.onChange('')}
          aria-label="검색어 지우기"
        >
          <X size={16} />
        </button>
      </Show>
    </form>
  )
}
