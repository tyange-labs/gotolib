import { Show, createSignal } from 'solid-js'

interface Props {
  onFile: (file: File) => void
  /** 목록이 있을 때: 영역 대신 텍스트 버튼 하나 */
  compact?: boolean
}

export function ImportDropzone(props: Props) {
  // Solid의 ref는 변수에 직접 대입된다. .current가 없다.
  let input!: HTMLInputElement
  const [dragging, setDragging] = createSignal(false)

  const hiddenInput = (
    <input
      ref={input}
      type="file"
      accept=".xls,.xlsx,.csv,.tsv"
      hidden
      onChange={(e) => {
        const file = e.currentTarget.files?.[0]
        if (file) props.onFile(file)
        e.currentTarget.value = ''
      }}
    />
  )

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer?.files[0]
    if (file) props.onFile(file)
  }

  return (
    <Show
      when={!props.compact}
      fallback={
        <>
          <button class="text-button" onClick={() => input.click()}>
            불러오기
          </button>
          {hiddenInput}
        </>
      }
    >
      <div
        class={`dropzone${dragging() ? ' dropzone--active' : ''}`}
        onClick={() => input.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        role="button"
        tabindex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') input.click()
        }}
      >
        <p class="dropzone__title">알라딘 보관함 파일 불러오기</p>
        <p class="dropzone__hint">xls · xlsx · csv를 끌어다 놓거나 클릭</p>
        {hiddenInput}
      </div>
    </Show>
  )
}
