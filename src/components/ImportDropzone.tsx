import { useRef, useState, type DragEvent } from 'react'

interface Props {
  onFile: (file: File) => void
}

export function ImportDropzone({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }

  return (
    <div
      class={`dropzone${dragging ? ' dropzone--active' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
      }}
    >
      <p class="dropzone__title">알라딘 보관함 파일 불러오기</p>
      <p class="dropzone__hint">
        내보내기한 파일(xls, xlsx, csv)을 끌어다 놓거나 클릭해서 선택하세요
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".xls,.xlsx,.csv,.tsv"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
