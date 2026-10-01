import { For } from 'solid-js'
import { ALL_CLASSES } from '../hooks/useBookFilter'
import type { ClassTab } from '../lib/kdc'

interface Props {
  tabs: ClassTab[]
  total: number
  selected: string
  onSelect: (value: string) => void
}

/** KDC 주류 분류 필터: 칩 열 대신 select 하나 */
export function GenreTabs(props: Props) {
  return (
    <div class="filter">
      <select
        class="filter__select"
        aria-label="분류"
        value={props.selected}
        onChange={(e) => props.onSelect(e.currentTarget.value)}
      >
        <option value={ALL_CLASSES}>
          {ALL_CLASSES} ({props.total})
        </option>
        <For each={props.tabs}>
          {(tab) => (
            <option value={tab.label}>
              {tab.label} ({tab.count})
            </option>
          )}
        </For>
      </select>
    </div>
  )
}
