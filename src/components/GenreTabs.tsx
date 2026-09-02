import { For } from 'solid-js'
import { ALL_CLASSES } from '../hooks/useBookFilter'
import type { ClassTab } from '../lib/kdc'

interface Props {
  tabs: ClassTab[]
  total: number
  selected: string
  onSelect: (value: string) => void
}

/** KDC 주류 분류 탭 (가로 스크롤 칩) */
export function GenreTabs(props: Props) {
  return (
    <div class="genre-tabs" role="tablist" aria-label="분류">
      <Chip
        label={ALL_CLASSES}
        count={props.total}
        active={props.selected === ALL_CLASSES}
        onClick={() => props.onSelect(ALL_CLASSES)}
      />
      <For each={props.tabs}>
        {(tab) => (
          <Chip
            label={tab.label}
            count={tab.count}
            active={props.selected === tab.label}
            onClick={() => props.onSelect(tab.label)}
          />
        )}
      </For>
    </div>
  )
}

function Chip(props: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      role="tab"
      aria-selected={props.active}
      class={`genre-chip${props.active ? ' genre-chip--active' : ''}`}
      onClick={() => props.onClick()}
    >
      {props.label}
      <span class="genre-chip__count">{props.count}</span>
    </button>
  )
}
