import { ALL_CLASSES } from '../hooks/useBookFilter'
import type { ClassTab } from '../lib/kdc'

interface Props {
  tabs: ClassTab[]
  total: number
  selected: string
  onSelect: (value: string) => void
}

/** KDC 주류 분류 탭 (가로 스크롤 칩) */
export function GenreTabs({ tabs, total, selected, onSelect }: Props) {
  return (
    <div className="genre-tabs" role="tablist" aria-label="분류">
      <Chip
        label={ALL_CLASSES}
        count={total}
        active={selected === ALL_CLASSES}
        onClick={() => onSelect(ALL_CLASSES)}
      />
      {tabs.map((tab) => (
        <Chip
          key={tab.label}
          label={tab.label}
          count={tab.count}
          active={selected === tab.label}
          onClick={() => onSelect(tab.label)}
        />
      ))}
    </div>
  )
}

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      className={`genre-chip${active ? ' genre-chip--active' : ''}`}
      onClick={onClick}
    >
      {label}
      <span className="genre-chip__count">{count}</span>
    </button>
  )
}
