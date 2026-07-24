export interface Segment<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  segments: readonly Segment<T>[]
  value: T
  onChange: (value: T) => void
}

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
}: Props<T>) {
  return (
    <div className="segmented" role="tablist">
      {segments.map((seg) => (
        <button
          key={seg.value}
          role="tab"
          aria-selected={seg.value === value}
          className={`segmented__option${
            seg.value === value ? ' segmented__option--active' : ''
          }`}
          onClick={() => onChange(seg.value)}
        >
          {seg.label}
        </button>
      ))}
    </div>
  )
}
